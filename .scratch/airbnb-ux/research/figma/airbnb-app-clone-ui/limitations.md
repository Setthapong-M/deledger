# ข้อจำกัดและสิ่งที่ยังไม่ยืนยัน

- ไฟล์นี้ยืนยันได้ว่าเป็น Figma design file ที่เข้าถึงได้ด้วย file key `LtZClzhjBrIfy0imWJnlEg` เท่านั้น ยังยืนยัน owner, publisher, community listing, license, version หรือ last-modified time ไม่ได้
- ชื่อ `Airbnb App Clone UI`, โลโก้ Airbnb และภาพ UI ไม่ใช่หลักฐานว่าเป็น official Airbnb source; หน้า design system มีข้อความ `Welcome to UiClones` จึงจัดเป็น third-party recreation/clone ที่ provenance ยังไม่ verified
- Page discovery และ page-level counts สำเร็จทั้ง 6 pages แต่ Figma MCP Starter rate limit เกิดหลัง screenshot export สำเร็จ 5 ครั้ง ทำให้ข้อมูลย่อยหลังจากนั้นถูกบล็อก
- ภาพที่มีใน `screens/` เป็น local PNG ที่ export ด้วย `maxDimension=1800`; `Components` และ `iOS` ถูกย่อจาก canvas ขนาดใหญ่มาก จึงใช้ตรวจ composition ระดับกว้าง ไม่ใช่หลักฐาน pixel-level ของทุก screen
- ยังไม่ได้รับค่าจริงของ Variables, Variable Collections, modes, aliases, local Paint/Text/Effect styles หรือ bindings
- ยังไม่ได้รับ component property definitions, variant properties, main-component relations, instance overrides หรือ Code Connect mapping แบบครบถ้วน
- ยังไม่ได้รับ prototype reactions, starting points, transitions, navigation, overlays, scroll behavior หรือ component interactions
- ยังไม่ได้ดาวน์โหลด raw image fills, SVG icons, illustrations หรือ export settings ราย node; URL ของ Figma asset ที่เห็นระหว่าง tool call เป็น temporary และไม่ใช้เป็นหลักฐานหลัก
- ภาพนิ่งไม่ยืนยัน runtime behavior, responsive breakpoints, accessibility, keyboard behavior, localization, production typography หรือ current Airbnb web/app behavior
- รายการ text ที่ระบุใน analysis เป็นข้อความที่มองเห็นจาก metadata/screenshot เท่านั้น ไม่ควรนำไปเป็น copy specification ของ Deledger โดยอัตโนมัติ
- การ mapping ไป Deledger เป็น design research และข้อเสนอระดับ confidence เท่านั้น ไม่แก้หรือเปลี่ยน CONTEXT.md, ADR, database, API หรือ application code
