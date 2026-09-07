# Deledger

Deledger เป็นแอปสรุปรายรับ–รายจ่ายรายเดือนจากยอดเงินรวม ผู้ใช้บันทึก Income และยอดเงินปลายเดือนเพื่อคำนวณ Monthly Spending โดยไม่ต้องลงธุรกรรมทุกครั้ง รองรับ Balance Snapshots, ค่าใช้จ่ายประจำ, การแก้เดือนที่ปิดแล้ว และการพัก/กลับมาติดตามข้อมูล

## Tech stack

| ส่วน | เทคโนโลยี | ความรับผิดชอบ |
| --- | --- | --- |
| Frontend | Next.js App Router, React, Tailwind CSS | UI, navigation และ same-origin API proxy |
| Backend | NestJS, TypeScript, Zod | API, authentication, validation, accounting, operator และ scheduler |
| Persistence | Prisma, PostgreSQL | Schema, migrations, database access, exact decimals และ forced RLS |
| Private ingress | Cloudflare WARP, Access, Tunnel | Private beta สำหรับผู้ได้รับอนุญาต |

```text
Local browser ──────────────────┐
                               ▼
WARP → Access → Tunnel → Next.js → NestJS → Prisma → PostgreSQL
                         web/      api/              db/
```

NestJS ถือ business logic รวมถึง logic ที่เคยอยู่ใน PostgreSQL functions; Next.js แสดงผลลัพธ์และ `allowedActions` การเขียนข้อมูลของผู้ใช้ผูก identity, lock และ RLS ภายใน transaction เดียว อ่านเหตุผลใน [ADR 0008](docs/adr/0008-split-presentation-and-business-services.md)

## เริ่มพัฒนาในเครื่อง

ติดตั้ง Node.js และ pnpm ตาม `engines` / `packageManager` ใน [package.json](package.json) พร้อม Docker Engine และ Compose ที่รองรับไฟล์ใน `infra/` ใช้ lockfile เป็น dependency baseline

```bash
corepack enable
pnpm install
pnpm dev:local
```

เปิด <http://127.0.0.1:3000> แล้ว login ด้วยอีเมลหรือเบอร์มือถือไทย local login ใช้สำหรับ development โดยไม่ต้องใช้รหัสผ่านหรือ OTP

`dev:local` เริ่ม PostgreSQL ของ local, generate Prisma client, apply migrations และเริ่ม Next กับ Nest หากต้องปรับค่า ให้สร้าง `.env.local` จาก [.env.local.example](.env.local.example) เมื่อยังไม่มีไฟล์ แล้วปรับ `LOCAL_*` ตาม [คู่มือ development](project-context/guides_flows/development.md) ส่วน `pnpm dev` เริ่มเฉพาะ frontend และต้องตั้ง Nest/API origin เอง

เลือกฐานข้อมูลใหม่ได้จาก `.env.local` เพียงไฟล์เดียว เช่น:

```dotenv
DELEDGER_ENV=local
LOCAL_DATABASE_NAME=deledger_local_v2
LOCAL_POSTGRES_PORT=55433
LOCAL_POSTGRES_PASSWORD=deledger-local-postgres
LOCAL_WEB_PASSWORD=deledger-local-web
LOCAL_IDENTITY_PASSWORD=deledger-local-identity
```

จากนั้นรัน `pnpm dev:local` ตามเดิม ชื่อ default คือ `deledger_local`; ชื่อที่เลือกต้องเป็น `deledger_local` หรือ `deledger_local_<suffix>` โดย suffix ใช้อักษรอังกฤษตัวเล็ก/ตัวเลข คั่นด้วย `_` และชื่อรวมไม่เกิน 63 ตัวอักษร URL สำหรับ admin, runtime, identity และ migration จะสร้างจากชื่อนี้อัตโนมัติ

Volume default แยกตามชื่อ เช่น `deledger_local_v2_pgdata` เมื่อเปลี่ยนชื่อให้หยุด API/Web ด้วย Ctrl-C ก่อน แล้วรันใหม่ ข้อมูลใน volume เดิมยังอยู่ ไม่มีการ reset, ลบ หรือย้ายข้อมูลอัตโนมัติ เปลี่ยนกลับเป็นชื่อเดิมเพื่อใช้ข้อมูลเดิมได้

`LOCAL_ADMIN_DATABASE_URL`, `LOCAL_DATABASE_URL` และ `LOCAL_IDENTITY_DATABASE_URL` เป็น optional override: ทุก URL ต้องตรงกับ `LOCAL_DATABASE_NAME`, ใช้ role ที่กำหนด และอยู่บน loopback host/port เดียวกัน โดยไม่มี query parameters หรือ fragments หากมี URL เดิมค้างใน `.env.local` ให้ลบเพื่อใช้ค่าที่สร้างอัตโนมัติ หรือแก้ให้ตรงกับชื่อใหม่

| Environment | Frontend / API | Database | Authentication |
| --- | --- | --- | --- |
| local | Loopback `3000` / `3001` | `deledger_local`, loopback `55433` | Local session |
| test | E2E loopback `3014` / `3015` | `deledger_test`, loopback `55432` | Fixtures และ signed JWT ในฐานทดสอบ |
| qas | `http://deledger.internal`, ไม่มี published host ports | `deledger` บน private Docker network | WARP + Access JWT + invitation |

`DELEDGER_ENV=prod` ยังไม่รองรับและทำให้ startup ปฏิเสธการทำงาน ส่วน QAS เป็น private beta ปัจจุบัน

ต้องการข้อมูลตัวอย่าง ให้มี `.env.local` จาก template แล้วเปิดอีก terminal หลัง local พร้อม ตัว seed อ่านไฟล์นี้อัตโนมัติและใช้ฐานเดียวกับ launcher:

```bash
pnpm seed:local
```

Seed สร้าง demo Users แบบ email, phone และ linked identity พร้อมตัวอย่างเดือนที่ reconcile แล้ว โดยข้าม demo Users ที่มีอยู่ ดูข้อมูลตัวอย่างใน [seed-local.mjs](scripts/seed-local.mjs)

## ตรวจคุณภาพ

```bash
pnpm qc
pnpm build
pnpm test:all
```

เลือกตรวจเฉพาะส่วนด้วย `test:unit`, `test:integration`, `test:e2e`, `test:ops` หรือ `test:coverage` ตาม [testing guide](project-context/qa_testing/README.md) ตัวรัน integration/E2E/operations/coverage ใช้ PostgreSQL ทดสอบแบบ disposable; รันทีละชุดเพราะใช้ฐานทดสอบเดียวกัน และหยุด local Next dev ก่อน E2E ใน checkout เดียวกัน

ESLint configuration ปัจจุบันยกเว้น TS/TSX ดังนั้น `lint` ผ่านอย่างเดียวไม่ยืนยันคุณภาพ TypeScript ต้องตรวจ compiler, tests และ review ด้วย

## Deploy และจัดการข้อมูล

ใช้ [deployment runbook](docs/operations/deploy-private-beta.md) และ [operator runbook](docs/operations/operator-runbook.md) สำหรับ migrations, invitation, archive/restore และ export เก็บ runtime environment และ secrets นอก Git; frontend ได้เฉพาะ API origin ส่วน database/Access verifier credentials อยู่ที่ Nest

Migration แรกของ stack นี้ต้องใช้ฐานใหม่ การเปลี่ยนจาก legacy database ต้องตรวจชื่อฐาน, Compose project และ volume ก่อนล้างข้อมูล `dev:local` apply migrations โดยไม่ reset ฐานเดิม การ reset local/QAS ต้องมีการอนุมัติที่ครอบคลุมเป้าหมาย และหลัง reset QAS ต้อง invite ผู้ใช้ใหม่

Private beta ตั้ง `BACKUP_MODE=disabled` จึงไม่มี recovery path หาก volume สูญหาย การเปิด backup ภายหลังต้องทำตาม [backup/restore runbook](docs/operations/backup-restore.md)

## โครงสร้างและบริบทกลาง

| Path | เนื้อหา |
| --- | --- |
| `web/` | Next frontend, components, API client/proxy และ browser/component tests |
| `api/` | Nest API, domain/services, Prisma schema/migrations และ backend tests |
| `db/`, `infra/`, `scripts/` | PostgreSQL bootstrap, deployment และ development/verification tools |
| [project-context/](project-context/README.md) | จุดเริ่มต้นกลางสำหรับ architecture, standards, guides, troubleshooting และ review |
| [CONTEXT.md](CONTEXT.md) | Domain glossary ที่ใช้อ้างอิงร่วมกัน |
| [docs/adr/](docs/adr/) | ประวัติและเหตุผลของ architectural decisions |
| `.scratch/` | Decision maps, specs, tickets และหลักฐานของแต่ละ effort |

นักพัฒนาเริ่มที่ [project-context/README.md](project-context/README.md) ส่วน AI Agents เริ่มที่ [AGENTS.md](AGENTS.md) แล้วเลือกเอกสารตาม [smart_router.yml](project-context/smart_router.yml) Router เป็นดัชนีการอ่าน ไม่ใช่ runtime plugin; หากเครื่องมือไม่โหลด entry file ให้อัตโนมัติ ให้แนบสองไฟล์นี้ใน task prompt
