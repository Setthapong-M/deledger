import { AppShell } from "@/components/app-shell";
import { LifecycleForm } from "@/components/lifecycle-form";

export default function StartPage() {
  return <AppShell><section className="lifecycle-page card" aria-labelledby="start-title"><p className="eyebrow">เริ่มต้นติดตาม</p><h1 id="start-title">เริ่มบัญชีรายรับรายจ่าย</h1><p>กรอกยอดที่รู้ตอนนี้ แล้วค่อยเติมรายละเอียดระหว่างเดือนได้ ไม่ต้องรอรอบหรือจำทุกรายการ</p><LifecycleForm mode="start" /></section></AppShell>;
}
