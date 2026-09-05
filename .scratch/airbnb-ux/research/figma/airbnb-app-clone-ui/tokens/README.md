# Tokens, styles และ variables

สถานะ: **blocked** ระหว่าง ingest รอบนี้

ยังไม่มีข้อมูลที่ยืนยันได้ของ Figma `PaintStyle`, `TextStyle`, `EffectStyle`, `GridStyle`, `VariableCollection`, modes, aliases หรือ variable bindings เพราะ Figma MCP rate limit เกิดก่อนเรียกเครื่องมือสำหรับรายละเอียดดังกล่าว

สิ่งที่เห็นจาก page inventory เป็นเพียงค่าที่ปรากฏบน node/ภาพ เช่น frame dimensions, component names และข้อความ UI ไม่ควรยกระดับเป็น design token จริงของ Figma การสังเคราะห์สี, spacing scale, typography scale หรือ radius จากภาพจะต้องเก็บในเอกสารแยกและติดป้าย `inferred` หากทำในรอบถัดไป

Resume target:

- `figma_get_libraries(fileKey)` เพื่อดู subscribed/available libraries
- `figma_get_variable_defs(fileKey,nodeId)` กับ representative screen/component nodes
- `figma_get_design_context` หรือ read-only Plugin API เพื่ออ่าน style IDs, fills, strokes, effects, typography และ variable bindings
- รักษา raw values, collection IDs, mode IDs และ alias targets ตาม source ก่อนเขียน semantic mapping ให้ Deledger
