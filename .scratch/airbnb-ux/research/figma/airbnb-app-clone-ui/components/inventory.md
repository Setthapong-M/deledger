# Component inventory

## Aggregate evidence

หน้า `💠 Components` มี `42 COMPONENT_SET`, `284 COMPONENT`, `812 INSTANCE`, `497 FRAME` และ `676 TEXT` จาก read-only page traversal. หน้า `➕ Icons` มี `14 COMPONENT_SET` และ `139 COMPONENT`. หน้า `↳ iOS v.1.0` มี `18 COMPONENT`, `3,638 INSTANCE` และ `4,216 FRAME` ซึ่งสะท้อนการประกอบหลาย screen จาก library เดียวกัน

## Component sections ที่อ่านได้

`Status Bars`, `Keyboards`, `Input`, `Cards`, `Toggles`, `Toast`, `Date Picker`, `Tabs`, `Links`, `Cells`, `Filter`, `Search`, `Checkbox`, `Title Bar`, `Modals`, `Wheel Picker`, `Bottom Bars` และ `Buttons` เป็น top-level sections ของ Components page พร้อม node IDs และขนาดใน [raw/page-inventory.json](../raw/page-inventory.json)

## Icon groups ที่อ่านได้

Metadata แสดงกลุ่ม `booking info`, `lisiting`, `profile`, `rules`, `listing-small`, `heart`, `where to`, `payment`, `action`, `common`, `arrow`, `social` และกลุ่มอื่นใน section `Icons` เช่น `message host`, `show listing`, `help`, `wallet`, `receipt`, `expense details`, `calendar`, `search`, `filter`, `check`, `edit-alt`, `error`, `chevron-*`, `share`, `close`, `like` และ state `on/off` ที่เห็นในชื่อ component

## สิ่งที่ยังไม่มี

ยังไม่ได้รับ variant property definitions, component states, boolean/text/instance properties, main component links, overrides, descriptions, published keys, style bindings หรือ per-component screenshots เนื่องจาก rate limit จึงจัด inventory นี้เป็น `partial` ไม่ใช่ component catalog ที่พร้อม copy แบบตรงตัว

## Relevance ต่อ Deledger

ชื่อ groups ที่น่าทดลองเป็น reference ได้แก่ `Cards`, `Input`, `Toast`, `Date Picker`, `Tabs`, `Cells`, `Modals`, `Bottom Bars`, `Buttons`, `Search` และ `Filter` แต่ต้องออกแบบใหม่ให้สอดคล้องกับ Financial Boundary, Reporting Month, Summary Input, Balance Snapshot และ Monthly Reconciliation ของ Deledger ไม่ควรนำ marketplace semantics หรือคำว่า booking/listing มาใส่ใน product domain
