import { AppShell } from "@/components/app-shell";
import { LifecycleForm } from "@/components/lifecycle-form";

export default function ResumePage() {
  return <AppShell><section className="lifecycle-page card" aria-labelledby="resume-title"><p className="eyebrow">กลับมาเริ่มใหม่</p><h1 id="resume-title">เริ่มติดตามจากเดือนนี้</h1><p>ช่วงก่อนหน้าจะถูกทำเครื่องหมายเป็นช่วงข้อมูลขาด ไม่ต้องย้อนสร้างรายการเดิม</p><LifecycleForm mode="resume" /></section></AppShell>;
}
