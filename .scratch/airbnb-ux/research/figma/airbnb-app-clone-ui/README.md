# Figma ingest: Airbnb App Clone UI

ชุดข้อมูลนี้เก็บหลักฐานที่อ่านได้จากไฟล์ Figma `Airbnb App Clone UI` เพื่อใช้เป็น reference สำหรับการออกแบบและพัฒนา Deledger งานนี้เป็น research artifact ยังไม่ใช่ accepted specification และยังไม่มีการแก้ application code, dependencies, domain rules หรือไฟล์ Figma ต้นทาง

## เริ่มอ่านตรงไหน

1. [manifest.json](manifest.json) — source, provenance, retrieval method และข้อจำกัดระดับชุดข้อมูล
2. [coverage.md](coverage.md) — page/section inventory และสถานะการ ingest
3. [raw/page-inventory.json](raw/page-inventory.json) — machine-readable page counts, top-level nodes และ provenance
4. [screens/](screens/) — ภาพ export ที่ดาวน์โหลดเป็นไฟล์ local ได้ 5 page-level frames
5. [components/inventory.md](components/inventory.md) — component sections และ counts ที่อ่านได้
6. [tokens/README.md](tokens/README.md) — สถานะ styles/variables
7. [flows/README.md](flows/README.md) — สถานะ prototype/interaction evidence
8. [analysis/deledger-mapping.md](analysis/deledger-mapping.md) — การตีความและ mapping ไปยัง Deledger
9. [limitations.md](limitations.md) — สิ่งที่ยังยืนยันไม่ได้และวิธี resume

## Source classification

จากหลักฐานที่อ่านได้ ไฟล์นี้จัดเป็น **third-party recreation / clone** ที่มาไม่สามารถยืนยันว่าเป็นไฟล์ทางการของ Airbnb ได้ ชื่อไฟล์คือ `Airbnb App Clone UI`, ในหน้า design system มีข้อความ `Welcome to UiClones` และผู้ใช้ที่เชื่อมต่อมีเพียง view seat ใน Figma Starter plan; ไม่มีข้อมูล publisher/owner/version ที่เครื่องมือคืนมา ชื่อและโลโก้ Airbnb จึงไม่ถือเป็นหลักฐานว่าเป็น official design

ภาพและชื่อ layer เป็นหลักฐานของ composition ที่อยู่ในไฟล์นี้เท่านั้น ไม่ยืนยันพฤติกรรมของเว็บหรือแอป Airbnb ปัจจุบัน, responsive breakpoint, accessibility, production tokens หรือ runtime interaction

## Ingest checkpoint

Page discovery และ top-level inventory สำเร็จทั้ง 6 pages. Page-level screenshot export สำเร็จ 5 รายการ: `🐑 Cover`, `📱 Mockup`, `➕ Icons`, `💠 Components` และ `↳ iOS v.1.0`. หลังจากนั้น Figma MCP คืน `tool call limit` ของ Starter plan ทำให้ screenshot และ detail extraction รายการที่เหลือถูกทำเครื่องหมาย `blocked` หรือ `partial` ตามเอกสาร ไม่เรียกว่า ingest ครบทั้งหมด
