# Prototype และ interaction evidence

สถานะ: **blocked**

รอบนี้อ่าน page inventory และ static screenshots ได้ แต่ยังไม่ได้รับ Figma `reactions`, prototype starting points, destination nodes, navigation type, overlay position, scroll behavior หรือ transition settings ก่อนเกิด rate limit จึงไม่มี interaction ที่ยืนยันได้ในชุดข้อมูลนี้

จากภาพ static เท่านั้นที่เห็นได้คือการจัดองค์ประกอบ เช่น bottom navigation labels `Explore`, `Wishlists`, `Trips`, `Inbox`, `Profile`, search capsule, category row, listing card และปุ่ม `Map` ใน mockup. สิ่งเหล่านี้ไม่ใช่หลักฐานว่ากดแล้วทำงานจริง

เมื่อ resume ให้แยก field ต่อไปนี้ใน JSON:

```json
{
  "sourceNodeId": "node id",
  "trigger": "Figma reaction trigger",
  "action": "navigation / overlay / scroll / url",
  "destinationNodeId": "node id or null",
  "transition": "raw Figma transition or null",
  "evidence": "declared | tested | inferred"
}
```
