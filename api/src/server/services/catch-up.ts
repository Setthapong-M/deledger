import { lockOwner } from "../db/rls.js";
import type { Prisma } from '../../generated/prisma/client.js';
import { currentBusinessDate,dateText,dateValue,nextMonthStart } from '../domain/calendar.js';
import { now } from '../domain/clock.js';
import { copySetup } from './lifecycle.js';

export async function catchUpOwner(client:Prisma.TransactionClient,ownerId:string):Promise<number> {
  await lockOwner(client,ownerId);
  const user=await client.app_user.findUnique({where:{id:ownerId}});
  if(!user) return 0;
  const currentMonth=`${currentBusinessDate().slice(0,7)}-01`;
  let changed=(await client.reporting_month.updateMany({where:{owner_id:ownerId,closed_at:null,month_start:{lt:dateValue(currentMonth)}},data:{closed_at:now(),closed_by:'automatic',updated_at:now(),revision:{increment:1}}})).count;
  const archived=await client.user_archive_period.findFirst({where:{owner_id:ownerId,restored_at:null}});
  if(archived || user.resume_required_at!==null) return changed;
  const last=await client.reporting_month.findFirst({where:{owner_id:ownerId},orderBy:{month_start:'desc'}});
  if(!last) return changed;
  let previous=dateText(last.month_start);
  let next=nextMonthStart(previous);
  while(next<=currentMonth) {
    const historical=next<currentMonth;
    await client.reporting_month.create({data:{owner_id:ownerId,month_start:dateValue(next),tracked_from:dateValue(next),opening_source:'prior_ending',...(historical ? {closed_at:now(),closed_by:'automatic',revision:1n} : {})}});
    await copySetup(client,ownerId,dateValue(previous),dateValue(next));
    changed+=historical ? 2 : 1;
    previous=next;
    next=nextMonthStart(next);
  }
  return changed;
}

export async function catchUpAll(client:Prisma.TransactionClient):Promise<number> {
  let changed=0;
  for(const user of await client.app_user.findMany({select:{id:true},orderBy:{id:'asc'}})) changed+=await catchUpOwner(client,user.id);
  return changed;
}
