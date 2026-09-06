# Exported screen evidence

ภาพทั้งหมดเป็น PNG ที่ดาวน์โหลดจาก Figma MCP แล้วเก็บ local; `sourceNodeId` และขนาดต้นฉบับมาจาก export response/metadata. ภาพที่ย่อมากเป็น page canvas overview และไม่ควรใช้วัด typography หรือ spacing ราย component

| Page/node | Local evidence | Visual cross-check |
|---|---|---|
| `🐑 Cover` / `0:1` | [0-1_cover-page.png](0-1_cover-page.png) | เห็น title `Airbnb App Clone`, `v1.0`, `122 Editable Screens`, iOS badge, launch screen และ Explore-style phone mockup; สอดคล้องกับ page root `cover` และ 48 frames/45 instances |
| `📱 Mockup` / `5:23` | [5-23_mockup-page.png](5-23_mockup-page.png) | เห็น 2 populated mobile mockups และ 2 launch screens; search capsule, category row, property card, Map pill และ bottom navigation ตรงกับ `Cover Mockup` section ขนาด 2402x1209 |
| `➕ Icons` / `2:13` | [45-14021_icons-page.png](45-14021_icons-page.png) | เห็นกลุ่ม icon หลายชุดและ state pairs; สอดคล้องกับ 14 component sets/139 components แต่ภาพกว้างถูกย่อ |
| `💠 Components` / `2:15` | [2-15_components-page.png](2-15_components-page.png) | เห็นหลาย section ของ controls/cards/form patterns; สอดคล้องกับ 18 top-level sections แต่ canvas 32874px ถูกย่อเหลือ 1800x153 จึงอ่านรายละเอียดไม่ได้ |
| `↳ iOS v.1.0` / `2:16` | [2-16_ios-page.png](2-16_ios-page.png) | เห็นกลุ่ม screen flows เรียงตาม section; สอดคล้องกับ 12 sections และ 4216 frames แต่ canvas 17283x32115 ถูกย่อเหลือ 969x1800 |

ไม่มีภาพ local สำหรับ `🏗️ Design System Components` หรือ individual iOS/component sections เพราะ rate limit เกิดก่อน export รายการเหล่านั้น
