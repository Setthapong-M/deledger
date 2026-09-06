# Coverage checklist

สถานะใช้ `complete` เมื่อ inventory ระดับ page/section สำเร็จ, `partial` เมื่อมีข้อมูลบางชนิดแต่ยังขาด detail, `blocked` เมื่อเครื่องมือคืน rate-limit error และ `excluded` เมื่ออยู่นอกขอบเขต

| ขอบเขต | รายการ | สถานะ | หลักฐาน/หมายเหตุ |
|---|---|---|---|
| Pages | 6 pages: Cover, Mockup, Icons, Components, iOS v.1.0, Design System Components | complete | `raw/page-inventory.json` |
| Top-level sections | 18 component sections + 12 iOS screen sections + other page roots | complete | IDs, names, dimensions และ counts ถูกบันทึก |
| Page-level screenshots | 5/6 exported locally | partial | Cover, Mockup, Icons, Components, iOS สำเร็จ; Design System blocked |
| Individual iOS screen screenshots | 0/12 | blocked | rate limit เกิดก่อนรายการย่อย |
| Individual component-section screenshots | 0/18 | blocked | rate limit |
| Node hierarchy | counts และ top-level structure ทั้ง 6 pages | partial | full raw hierarchy ไม่ได้ persist จาก response ที่ถูกตัด/blocked |
| Components and variants | aggregate counts: 42 component sets, 284 components, 812 instances on Components page; 18 components/3638 instances on iOS page | partial | per-variant properties และ instance overrides blocked |
| Icons | 14 component sets, 139 components, categories visible in metadata | partial | individual SVG export blocked |
| Styles | local style names/values | blocked | no tool response before rate limit |
| Variables | collections, modes, aliases, bindings | blocked | no tool response before rate limit |
| Prototype | reactions, transitions, overlays, starting points | blocked | no tool response before rate limit |
| Exportable assets | raw images/SVGs/icons | blocked | `download_assets` could not run after limit |
| Deledger analysis | UX mapping with existing source/ADR context | complete_for_available_evidence | [analysis/deledger-mapping.md](analysis/deledger-mapping.md) |

## Resume order

เมื่อ rate limit reset ให้ดึงตามลำดับนี้: (1) Design System screenshot, (2) individual iOS sections, (3) component sections, (4) `get_design_context`/read-only node detail for representative screens and component sets, (5) libraries, variables and styles, (6) prototype reactions, (7) `download_assets` and asset manifest. อัปเดตสถานะในไฟล์นี้และ `manifest.json` โดยไม่ลบหลักฐานชุดเดิม
