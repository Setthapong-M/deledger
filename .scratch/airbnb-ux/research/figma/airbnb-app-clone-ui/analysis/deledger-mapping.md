# วิเคราะห์การนำ reference ไปใช้กับ Deledger

เอกสารนี้เป็น interpretation จาก Figma clone ที่เข้าถึงได้และ code/domain ปัจจุบันของ Deledger ไม่ใช่ specification และไม่ใช่ข้อสรุปว่า Airbnb ใช้ behavior เหล่านี้ใน production

## หลักฐาน visual/structural ที่มี

- `📱 Mockup` แสดง mobile shell ที่มี search capsule `Where to?`, category row, listing card แบบ image-first, pagination dots, heart action, location/host/date/total และ bottom navigation `Explore`, `Wishlists`, `Trips`, `Inbox`, `Profile` พร้อมปุ่ม `Map`
- `💠 Components` แสดง library sections สำหรับ `Input`, `Cards`, `Toast`, `Date Picker`, `Tabs`, `Cells`, `Modals`, `Bottom Bars`, `Buttons`, `Search` และ `Filter`
- `↳ iOS v.1.0` จัดกลุ่ม flow เป็น `Launch Screen`, `Sign Up`, `Account Setup`, `Onboarding`, `Explore`, `Listing Details`, `Book a Listing`, `Trips`, `Experiences`, `Wishlists`, `Inbox`, `Profile`
- `➕ Icons` มี semantic icon groups และ state pairs เช่น `heart on/off`, `where to on/off`, `warning`, `lock`, `calendar`, `search`, `filter`, `check`, `error`, `edit-alt` และ arrows
- Design system page ใช้ชื่อ `UiClones` ใน text `Welcome to UiClones`; จึงใช้เป็น clone reference ไม่ถือเป็น official Airbnb design system

หลักฐานอ้างกลับ: [Mockup image](../screens/5-23_mockup-page.png), [Components image](../screens/2-15_components-page.png), [iOS page image](../screens/2-16_ios-page.png), [Icons image](../screens/45-14021_icons-page.png), node IDs และ dimensions ใน [page inventory](../raw/page-inventory.json)

## ข้อเสนอเรียงตามความสำคัญ

### P1 — ใช้ shell ที่จัดลำดับ “เดือน → ยอดสำคัญ → งานถัดไป”

- หลักฐาน: Mockup จัด search/category/listing ใน shell เดียว และมี bottom navigation ที่คงที่; iOS page แยก Explore, Trips, Inbox และ Profile เป็น destinations
- หลักการ UX: ให้บริบทหลักและ action ที่ทำซ้ำได้อยู่ในตำแหน่งคงที่
- Deledger มีแล้ว: `Navigation` มี `เดือนนี้`, `ประวัติ`, `ข้อมูลส่วนตัว`; `MonthSummary` มียอดสำคัญและ `MonthTimeline` มีลำดับข้อมูล
- เสนอให้ทดลอง: จัด `Reporting Month`, reconciliation status และ next action ให้อยู่เหนือรายละเอียด; คง navigation เดิมเป็น baseline และใช้ mobile bottom navigation เฉพาะเมื่อข้อมูลการใช้งานรองรับ
- Domain/ADR: ไม่กระทบ Financial Boundary หรือ calculation หากเป็น presentation layer; ต้องไม่ใช้คำว่า `Trips`/`listing` แทน Reporting Month
- Confidence: medium; ภาพ page-level ของ iOS ถูกย่อและไม่มี interaction evidence

### P1 — ทำ summary card ให้สแกนง่ายและเปิด detail ได้

- หลักฐาน: listing card มี image/metadata/total เป็นชั้น ๆ; booking flow มี sections แยก `Your trip`, `Price details`, `Pay with`, `Cancellation policy`
- หลักการ UX: แสดง total ที่สำคัญก่อน แล้ว progressive disclosure ไปยัง breakdown
- Deledger มีแล้ว: `MonthSummary` แสดง Starting Balance, Income, Ending Balance และ Monthly Spending; `HistoryExplorer` แสดง detail total และ unitemized spending
- เสนอให้ทดลอง: ทำ `Monthly Spending` เป็น focal total พร้อม link/expander `ดูวิธีคำนวณ`; แยก `รายจ่ายโดยประมาณ` เมื่อใช้ Balance Snapshot ออกจาก `Monthly Spending` ที่อาศัย Ending Balance
- Domain/ADR: ต้องคงว่า Balance Snapshot ไม่ใช่ Ending Balance; Monthly Expense Detail อธิบายยอดและไม่เพิ่ม Monthly Spending; สอดคล้อง ADR 0002 และ 0006
- Confidence: medium; booking price breakdown เป็น evidence จาก clone ไม่ใช่ requirement ของ Deledger

### P1 — เพิ่ม review surface ก่อน Manual Close

- หลักฐาน: `Book a Listing` มี review sections และ final confirmation copy ก่อน action
- หลักการ UX: ใช้ confirmation ที่มีข้อมูลพอให้ตรวจความผิดพลาดก่อน action ที่มีความหมาย
- Deledger มีแล้ว: dialog `ปิดเดือนนี้?` ใน `web/src/app/month/page.tsx` ระบุว่าแก้ไขได้และมีปุ่มยืนยัน
- เสนอให้ทดลอง: เพิ่ม Reporting Month, Income, Ending Balance, Monthly Spending, reconciliation status และผลกระทบ downstream ใน dialog เดิม
- Domain/ADR: รักษา manual gate วันสุดท้ายและ complete/coherent Summary Inputs; ห้ามทำให้ Automatic Close ต้องผ่าน dialog; Closed Month ยัง correctable ตาม ADR 0001/0003
- Confidence: high สำหรับแนวคิด review, medium สำหรับ geometry/copy เพราะยังขาด per-screen export

### P2 — ใช้ component categories เป็น checklist ของ states

- หลักฐาน: Components page มี `Input`, `Toast`, `Modals`, `Checkbox`, `Date Picker`, `Tabs`, `Cells`, `Buttons`, `Status Bars`
- หลักการ UX: ออกแบบ state และ feedback เป็นระบบ ไม่ทำ control เฉพาะหน้าแบบแยกส่วน
- Deledger มีแล้ว: `BalanceDialog`, `MoneyField`, `FeedbackBanner`, `StatusBadge`, `HistoryExplorer`
- เสนอให้ทดลอง: ทำ state matrix ของ input error, saving, success, needs information, inconsistent, closed และ tracking gap; ใช้ข้อความและ icon ที่อ่านได้โดยไม่พึ่งสีอย่างเดียว
- Domain/ADR: Tracking Gap ต้องแยกจาก Needs Information; status ต้องสื่อ reconciliation กับ lifecycle คนละมิติ; ไม่เพิ่ม transaction detail ที่ domain ไม่ต้องการ
- Confidence: medium; component property/variant data ถูก rate limit

### P2 — ใช้ history pattern เป็น reference ของช่วงเวลา แต่รักษาคำศัพท์ domain

- หลักฐาน: iOS page แยก `Trips`, `Wishlists`, `Inbox`, `Profile`; Mockup ใช้ card collection และ selected navigation
- หลักการ UX: collection/history ควรมี selected state, context และทางย้อนกลับที่ชัด
- Deledger มีแล้ว: `HistoryExplorer` มี filmstrip, selected month, arrow navigation และ Tracking Gap card
- เสนอให้ทดลอง: รักษา filmstrip เป็น reference ได้ แต่แสดงชื่อ Reporting Month, Partial Month, Closed Month และ Tracking Gap ที่เป็นภาษาไทยสม่ำเสมอ; อย่าใช้ raw reconciliation state ภาษาอังกฤษ
- Domain/ADR: Tracking Gap ไม่ใช่เดือนที่ต้องเติมข้อมูล; Closed Month ยังแก้ไขได้; ห้ามอนุมาน continuity ข้าม gap ตาม ADR 0004
- Confidence: high สำหรับ semantic mapping, low สำหรับ visual geometry

### P2 — ใช้ icon semantics อย่างมี restraint

- หลักฐาน: Icons page มี semantic names เช่น `calendar`, `search`, `filter`, `check`, `error`, `warning`, `lock`, `edit-alt`, `chevron-*`, `heart on/off`
- หลักการ UX: icon ควรเสริม label และ state ไม่แทนความหมายที่สำคัญ
- Deledger มีแล้ว: StatusBadge ใช้ symbol และ text; dialogs มี labels และ errors
- เสนอให้ทดลอง: ใช้ calendar สำหรับ Reporting Month, check/error/warning สำหรับ reconciliation และ edit สำหรับแก้ Summary Input พร้อม accessible name; อย่านำ heart/booking icons มาใช้โดยไม่มี domain meaning
- Domain/ADR: ไม่เปลี่ยน model; ตรวจว่า icon ไม่ทำให้ Balance Snapshot ดูเป็น Ending Balance
- Confidence: medium; SVG source และ token values ยังไม่ถูก export

## สิ่งที่ยังต้องทดสอบกับ Deledger

1. ผู้ใช้ระบุเดือน, ความน่าเชื่อถือของยอด และ next action ได้จากหน้าแรกหรือไม่
2. ผู้ใช้แยก Balance Snapshot, Ending Balance, Monthly Spending และ Unitemized Spending ได้หรือไม่
3. ผู้ใช้เห็นผลกระทบของการแก้ Closed Month ต่อ downstream Reporting Months ก่อนยืนยันหรือไม่
4. ผู้ใช้แยก Needs Information, Inconsistent Month และ Tracking Gap โดยไม่อาศัยสีอย่างเดียวหรือไม่
5. Dialog, HistoryExplorer และ input ทำงานเมื่อ keyboard navigation, text zoom และ narrow viewport หรือไม่

ข้อเสนอทั้งหมดควรผ่าน prototype/usability review ก่อน implement และไม่ควรแก้ domain rules เพื่อให้เหมือน clone
