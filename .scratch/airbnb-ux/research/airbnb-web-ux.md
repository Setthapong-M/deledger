# Airbnb web UX: ข้อมูลประกอบการพัฒนา Deledger

วันที่ตรวจ: 5 กันยายน 2026 (Asia/Bangkok)

## ขอบเขตและวิธีอ่านหลักฐาน

ศึกษาหน้าเว็บสาธารณะของ Airbnb และเอกสาร first-party แล้วเทียบกับ domain และ source code ของ Deledger เพื่อหาแนวทาง UX ที่นำมาทดลองได้ รายงานนี้เป็น research และข้อเสนอ ยังไม่ได้เปลี่ยน implementation หรือกำหนด design specification

- **พบจากเว็บโดยตรง** หมายถึงข้อความและโครงสร้างที่ web reader อ่านจาก URL จริง ไม่ใช่การตรวจภาพหน้าจอหรือ interaction
- **Airbnb อธิบายไว้** หมายถึง Help Center หรือประกาศผลิตภัณฑ์ ไม่ใช่ผลทดสอบว่าหน้าเว็บทุก locale ทำงานเช่นนั้น
- **ข้อเสนอสำหรับ Deledger** เป็นการตีความจากหลักฐานและ domain ต้องทดลองกับผู้ใช้ก่อนสรุปผลด้าน usability

หน้าแรกที่อ่านคืนข้อความเตือนเรื่อง JavaScript และ locale English (US)/USD จึงยังยืนยัน layout, spacing, สี, breakpoint, animation, search results, listing detail หรือ checkout ปัจจุบันไม่ได้ ไม่ได้ login หรือทำรายการจอง การอ้าง accessibility ด้านล่างเป็นคำประกาศของ Airbnb ไม่ใช่การรับรองจากการตรวจของเรา [Airbnb homepage](https://www.airbnb.com/), [Accessibility Statement](https://www.airbnb.com/help/article/3928)

## หลักฐานและสิ่งที่นำมาใช้ได้

| ประเด็น | หลักฐานจาก Airbnb | การตีความสำหรับ Deledger |
| --- | --- | --- |
| Hierarchy ตามงานหลัก | **พบจากเว็บโดยตรง:** หน้าแรกมีหมวด All/Homes/Experiences/Services และ input ค้นหาแบ่ง Where, When, Who; มี Skip to content ส่วนต้นเอกสาร และ Help Center ใน navigation [หน้าแรก](https://www.airbnb.com/) | ให้เดือนที่กำลังจัดการ สถานะ และงานถัดไปมีความสัมพันธ์ชัดเจน ไม่จำเป็นต้องนำ search bar หรือโครงสร้าง marketplace มาใช้ |
| Total พร้อมขอบเขตความหมาย | **Airbnb อธิบายไว้:** ประกาศ 21 เมษายน 2025 ระบุว่าผลค้นหาจะแสดงราคารวมค่าธรรมเนียมทั่วโลก โดยภาษีขึ้นกับประเทศ/ภูมิภาค และแสดงยอดรวมภาษีก่อน checkout [Total price display](https://news.airbnb.com/total-price-display-is-now-standard-globally) | ยอดเด่นควรบอกทั้งจำนวนและความหมาย เช่น ยอดคำนวณแล้วหรือยอดประมาณ ไม่ให้ผู้ใช้ตีความ label เดียวกันต่างกันระหว่างหน้า |
| Progressive disclosure | **Airbnb อธิบายไว้:** host เลือกวันใน Calendar แล้วเปิด Price per night และ Guest price before taxes เพื่อดูรายละเอียดราคาและรายได้; บทความแยกข้อจำกัดของ estimated fees และ additional fees [Preview your price breakdown](https://www.airbnb.com/help/article/3638) | ให้ยอดรวมเป็นจุดเริ่ม แล้วเปิดดูสูตรและที่มาของยอดได้ โดยไม่ซ่อนคำเตือนที่จำเป็นต่อการตีความยอด |
| Review ก่อน confirmation | **Airbnb อธิบายไว้:** flow รับ invitation to book บน desktop ให้ตรวจรายละเอียด invitation ตรวจ payment info แล้วจึง Confirm reservation; หลักฐานนี้ครอบคลุม flow invitation เท่านั้น [How an invitation to book works](https://www.airbnb.com/help/article/838) | ใช้จุดยืนยันที่มีอยู่เพื่อให้ตรวจ Summary Inputs และผลคำนวณก่อน Manual Close ไม่ต้องเพิ่มขั้นยืนยันให้ทุกการกรอก |
| สถานะที่ตอบว่าต้องทำอะไรต่อ | **Airbnb อธิบายไว้:** reservation status บอกได้ว่าจองสำเร็จหรือยังต้องให้ข้อมูล เช่น identity verification และค้นสถานะได้ใน message thread [Find your reservation status](https://www.airbnb.com/help/article/234) | สถานะของ Reporting Month ควรบอกเหตุและ next action พร้อมแยก lifecycle ออกจาก reconciliation และ Tracking Gap |
| Responsive และ accessibility | **Airbnb อธิบายไว้:** มีการทดสอบ keyboard-only บน desktop, screen reader หลายชุด และขนาดมือถือเล็ก/ใหญ่ รวมถึง adjustable font sizes; ระบุ responsive design และ reduced motion แต่ยอมรับว่าไม่ได้ทดสอบ tablet compatibility [Accessibility Statement](https://www.airbnb.com/help/article/3928) | ตั้งเกณฑ์ทดสอบของ Deledger เองทั้งหน้าสรุป dialog และประวัติ โดยระบุ device/assistive technology ที่ตรวจจริง ไม่อ้างความสามารถจากหน้าตาภายนอก |

## บริบทของ Deledger ที่ต้องรักษา

Deledger คำนวณ Monthly Spending จาก Summary Inputs โดยไม่ต้องสร้าง Transaction Details; Balance Snapshot ยังไม่ใช่ Ending Balance จนกว่าจะยืนยัน และ Monthly Expense Details อธิบายยอดใช้จ่าย ไม่ได้เพิ่มยอดใช้จ่ายที่คำนวณแล้ว [CONTEXT.md](/home/admin/vault/deledger/CONTEXT.md)

Closed Month ยังแก้ไขได้และอาจเปลี่ยนยอดเดือนถัดไป; Manual Close ทำได้วันสุดท้ายของเดือนเมื่อข้อมูลครบและสอดคล้อง แต่ Automatic Close เกิดตามปฏิทินแม้ข้อมูลไม่ครบ [ADR 0001](/home/admin/vault/deledger/docs/adr/0001-closed-months-remain-correctable.md), [ADR 0003](/home/admin/vault/deledger/docs/adr/0003-manual-and-automatic-close-use-different-gates.md)

ข้อมูลที่ยืนยันใน Monthly Expense Detail ต้องรักษาข้อเท็จจริง ณ เวลายืนยัน ส่วน summary และสถานะคำนวณจาก stored facts [ADR 0002](/home/admin/vault/deledger/docs/adr/0002-monthly-expense-details-preserve-confirmed-facts.md), [ADR 0006](/home/admin/vault/deledger/docs/adr/0006-derive-monthly-summaries-from-stored-facts.md)

## ข้อเสนอเรียงลำดับสำหรับทดลอง

ลำดับด้านล่างเป็น judgment ของผู้วิจัยจากผลกระทบต่อความเข้าใจทางการเงิน ไม่ใช่ผล A/B test ของ Airbnb หรือ implementation plan

### 1. P1 — ให้ยอดประมาณและยอดยืนยันใช้ภาษาสอดคล้องทุกหน้า

**สิ่งที่มีแล้ว:** MonthSummary แยก “รายจ่ายโดยประมาณ” กับ “รายจ่ายทั้งเดือน” แต่ History Cover ใช้ “รายจ่ายทั้งเดือน” แม้เลือกค่า fallback จาก provisionalSpending [month-summary.tsx](/home/admin/vault/deledger/web/src/components/month-summary.tsx), [history-explorer.tsx](/home/admin/vault/deledger/web/src/components/history-explorer.tsx)

**ข้อเสนอ:** ใช้กติกา label ร่วมกันในเดือนนี้และประวัติ พร้อมบอกเมื่อยอดอาศัย Snapshot หรือยังคำนวณไม่ได้ หลักฐานที่นำมาตีความคือการแสดง total พร้อมขอบเขตว่ารวมอะไรแล้ว [Total price display](https://news.airbnb.com/total-price-display-is-now-standard-globally)

**เกณฑ์ทดลอง:** ผู้ใช้เห็นเดือนที่มีเฉพาะ Snapshot แล้วบอกได้ว่ายอดใดยังเป็นประมาณการ และไม่เข้าใจว่าเป็น Ending Balance ที่ยืนยันแล้ว

### 2. P1 — แยกสถานะเดือน ข้อมูลที่ขาด และช่วงหยุดติดตาม

**สิ่งที่มีแล้ว:** StatusBadge มีภาษาไทยพร้อมสัญลักษณ์และ Partial annotation แต่ History filmstrip แสดง raw state ภาษาอังกฤษ และ Tracking Gap ใช้ badge needs_information [status-badge.tsx](/home/admin/vault/deledger/web/src/components/status-badge.tsx), [history-explorer.tsx](/home/admin/vault/deledger/web/src/components/history-explorer.tsx)

**ข้อเสนอ:** ให้ state เดียวกันใช้คำเดียวกันทุกหน้า; Tracking Gap ควรอธิบายว่าเป็นช่วงหยุดติดตาม ไม่ทำให้ดูเป็น Reporting Month ที่ต้องเติมข้อมูล ส่วน Needs Information ให้ระบุ input ที่ขาดและทางไปแก้ไข หลักฐานแรงบันดาลใจคือสถานะที่บอกทั้งผลและข้อมูลที่ยังต้องทำ [Reservation status](https://www.airbnb.com/help/article/234)

**เกณฑ์ทดลอง:** ผู้ใช้แยกได้ระหว่าง “ปิดแล้วแต่ยังขาดข้อมูล”, “ยอดไม่สอดคล้อง” และ “ไม่มีการติดตามช่วงนี้” โดยไม่อาศัยสีอย่างเดียว

### 3. P1 — เพิ่มสรุปให้ตรวจใน dialog Manual Close ที่มีอยู่

**สิ่งที่มีแล้ว:** หน้าเดือนมี dialog ยืนยันปิดเดือนพร้อมข้อความว่ายังแก้ไขข้อมูลได้ แต่ไม่มีตารางยอดให้ตรวจใน dialog นั้น [month/page.tsx](/home/admin/vault/deledger/web/src/app/month/page.tsx)

**ข้อเสนอ:** เพิ่ม Reporting Month, Income, Ending Balance และ Monthly Spending แบบกระชับในจุดยืนยันเดิม พร้อมข้อความว่าการแก้ไขย้อนหลังอาจกระทบเดือนถัดไป รักษา gate วันสุดท้าย/ข้อมูลสอดคล้องของ Manual Close และไม่ใส่ confirmation gate ให้ Automatic Close อ้างอิงแนวคิด review ก่อน confirm จาก invitation flow [Booking invitation](https://www.airbnb.com/help/article/838)

**เกณฑ์ทดลอง:** ผู้ใช้ตรวจพบยอดผิดก่อนปิดเดือน และเข้าใจว่าปิดเดือนแล้วแก้ไขได้โดยไม่ต้องเปิดเดือนเดิม

### 4. P2 — เปิดดูที่มาของ Monthly Spending ได้จากยอดสรุป

**สิ่งที่มีแล้ว:** MonthSummary มี Starting Balance, Income, Ending Balance และยอดใช้จ่ายสี่ส่วน; History Cover มี detailTotal และ Unitemized Spending เพิ่มด้วย [month-summary.tsx](/home/admin/vault/deledger/web/src/components/month-summary.tsx), [history-explorer.tsx](/home/admin/vault/deledger/web/src/components/history-explorer.tsx)

**ข้อเสนอ:** เพิ่ม “ยอดนี้คำนวณอย่างไร” ใกล้ยอดใช้จ่าย เปิดสูตร `Starting Balance + Income − Ending Balance` และอธิบายแยก `Monthly Spending − Monthly Expense Details = Unitemized Spending`; ถ้าเป็น provisional ต้องบอกว่าอาศัย Snapshot แทนยอดยืนยัน ไม่เรียกผลนั้นว่า Monthly Spending ที่ยืนยันแล้ว แนวคิดมาจาก total ที่เปิด breakdown ได้ [Price breakdown](https://www.airbnb.com/help/article/3638)

**เกณฑ์ทดลอง:** ผู้ใช้อธิบายได้ว่าการยืนยันค่าไฟทำให้ Unitemized Spending ลดลง แต่ไม่ได้เพิ่มยอดรายจ่ายรวมอีกครั้ง

### 5. P2 — ทดลองลำดับ “เดือน → ยอดสำคัญ → สิ่งที่ต้องทำต่อ”

**สิ่งที่มีแล้ว:** Navigation มีเดือนนี้/ประวัติ/ข้อมูลส่วนตัว และ MonthSummary เน้นยอดใช้จ่ายด้วย class summary-emphasis อยู่แล้ว [navigation.tsx](/home/admin/vault/deledger/web/src/components/navigation.tsx), [month-summary.tsx](/home/admin/vault/deledger/web/src/components/month-summary.tsx)

**ข้อเสนอ:** ทดลองให้ next action ตาม state อยู่ใกล้ summary เช่น เติม Income หรือยืนยัน Ending Balance โดยเก็บ navigation เดิมเป็นฐาน แรงบันดาลใจมาจากการแยกข้อมูลที่งานหลักต้องใช้เป็นกลุ่มบนหน้าแรก Airbnb; ยังไม่มีหลักฐานภาพเพียงพอให้สรุปเรื่อง pixel hierarchy [Airbnb homepage](https://www.airbnb.com/)

**เกณฑ์ทดลอง:** เมื่อเปิดหน้าเดือน ผู้ใช้บอกได้ทันทีว่ากำลังดูเดือนไหน ยอดเชื่อถือระดับใด และควรทำอะไรต่อ โดยไม่ต้องไล่อ่านทุก section

### 6. P2 — ตรวจ responsive และ accessibility ของ flow การเงินทั้งชุด

**สิ่งที่มีแล้ว:** มี semantic navigation, aria-current, section heading, status text และ BalanceDialog ที่ใช้ MoneyField พร้อม error [navigation.tsx](/home/admin/vault/deledger/web/src/components/navigation.tsx), [month-summary.tsx](/home/admin/vault/deledger/web/src/components/month-summary.tsx), [status-badge.tsx](/home/admin/vault/deledger/web/src/components/status-badge.tsx), [balance-dialog.tsx](/home/admin/vault/deledger/web/src/components/balance-dialog.tsx)

**ข้อเสนอ:** ตรวจเงินจริงจำลองที่ยาว, หน้าจอแคบ/กว้าง/แท็บเล็ต, ขยายข้อความ, keyboard navigation, dialog focus/return focus และการอ่าน label/error/สถานะด้วย screen reader เก็บผลตามชุด browser/device ที่ใช้จริง แรงบันดาลใจคือแนวปฏิบัติและการประกาศขอบเขตการทดสอบของ Airbnb [Accessibility Statement](https://www.airbnb.com/help/article/3928)

**เกณฑ์ทดลอง:** กรอกยอด แก้ error ตรวจ summary และยืนยันปิดเดือนด้วย keyboard ได้ครบโดยไม่เสียบริบท และยอดกับหน่วยไม่ถูกตัดใน viewport ที่เลือกทดสอบ

## ขอบเขตการนำไปพัฒนาต่อ

เริ่มตรวจแนวคิด 1–3 ด้วยข้อมูลจำลองที่ครอบคลุม Snapshot-only, Needs Information, Inconsistent, Closed Month และ Tracking Gap ก่อนทำ visual redesign ข้อเสนอ 4–6 ใช้เป็นโจทย์ prototype และ acceptance criteria ได้ แต่ยังไม่ใช่ข้อสรุปว่าปัจจุบันทุกจุดมีปัญหา

หากต้องการศึกษา visual style ของ Airbnb ต่อ ต้องเพิ่ม browser inspection พร้อมภาพ desktop/mobile ของ homepage, search, listing และ flow review ที่เข้าถึงได้ ระบุ viewport/locale/session/date ให้ชัด แล้วจึงสรุป typography, spacing, component geometry และ responsive behavior หลักฐานชุดนี้ยังไม่เพียงพอสำหรับค่าการออกแบบเหล่านั้น
