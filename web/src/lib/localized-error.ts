import { ApiClientError } from "./api-client";
import type { Locale } from "./locale";

const errors: Record<string, { th: string; en: string }> = {
  CLOCK_CONFLICT: { th: "วันที่ระบบเปลี่ยนแล้ว ตรวจวันที่และยอดเงินอีกครั้งก่อนบันทึก", en: "The system date changed. Review the date and amounts before saving again." },
  DATE_RANGE_TOO_LARGE: { th: "เพิ่มได้ครั้งละไม่เกิน 24 เดือน เลือกวันเริ่มใหม่หรือแบ่งเพิ่มเป็นช่วง", en: "Add at most 24 months at a time. Choose a later start or add separate batches." },
  HISTORY_BOUNDARY_CONFLICT: { th: "ช่วงประวัติไม่ตรงกับวันที่ระบบ ตรวจหรือกลับวันที่จริงก่อนลองอีกครั้ง", en: "History conflicts with the system date. Adjust or reset the date before trying again." },
  HISTORY_RANGE_OVERLAP: { th: "ช่วงนี้มีข้อมูลแล้ว โหลดประวัติล่าสุดแล้วเลือกช่วงใหม่", en: "This range already has records. Refresh history and choose another range." },
  RESTART_NOT_ALLOWED: { th: "เดือนนี้เริ่มใหม่ไม่ได้แล้ว ตรวจข้อมูลล่าสุดหรือแก้ยอดในประวัติ", en: "This month can no longer start fresh. Review the latest records or correct history." },
  INVALID_INPUT: { th: "ตรวจข้อมูลที่กรอกแล้วลองอีกครั้ง", en: "Check your details and try again." },
  ACCESS_TOKEN_MISSING: { th: "เข้าสู่ระบบเพื่อใช้งานต่อ", en: "Sign in to continue." },
  ACCESS_TOKEN_INVALID: { th: "เข้าสู่ระบบอีกครั้งเพื่อใช้งานต่อ", en: "Sign in again to continue." },
  SESSION_INVALID: { th: "เข้าสู่ระบบอีกครั้งเพื่อใช้งานต่อ", en: "Sign in again to continue." },
  LOCAL_AUTH_DISABLED: { th: "เข้าสู่ระบบผ่านหน้าลงชื่อเข้าใช้ขององค์กร", en: "Sign in through your organization." },
  IDENTIFIER_INVALID: { th: "กรอกอีเมลหรือเบอร์มือถือไทยให้ถูกต้อง", en: "Enter a valid email or Thai mobile number." },
  USER_NOT_INVITED: { th: "บัญชีนี้ยังไม่ได้รับเชิญ ติดต่อผู้ดูแลเพื่อขอเข้าใช้", en: "This account hasn’t been invited. Contact your administrator." },
  USER_ARCHIVED: { th: "บัญชีนี้หยุดใช้งานอยู่ ติดต่อผู้ดูแลเพื่อกลับมาใช้งาน", en: "This account is paused. Contact your administrator to return." },
  MONTH_NOT_FOUND: { th: "ไม่พบข้อมูลเดือนนี้ ลองเลือกเดือนอื่น", en: "This month wasn’t found. Try another month." },
  SETUP_ITEM_NOT_FOUND: { th: "ไม่พบรายการนี้ โหลดข้อมูลแล้วลองอีกครั้ง", en: "This item wasn’t found. Refresh and try again." },
  REVISION_CONFLICT: { th: "ข้อมูลเปลี่ยนจากอีกหน้าจอแล้ว ตรวจยอดล่าสุดก่อนบันทึกอีกครั้ง", en: "This month changed in another tab. Check the latest amounts before saving again." },
  IDENTITY_CONFLICT: { th: "ทำรายการนี้ต่อไม่ได้ โหลดหน้าใหม่เพื่อตรวจสถานะล่าสุด", en: "This action can’t continue. Reload to check the latest status." },
  PROFILE_CONTACT_READ_ONLY: { th: "แก้ข้อมูลติดต่อที่นี่ไม่ได้ ติดต่อผู้ดูแลเพื่อเปลี่ยน", en: "Contact details can’t be changed here. Contact your administrator." },
  PROFILE_CONFLICT: { th: "ข้อมูลติดต่อนี้ใช้ไม่ได้ ลองอีเมลหรือเบอร์อื่น", en: "These contact details aren’t available. Try another email or number." },
  MONTH_NOT_OPEN: { th: "เดือนนี้ปิดแล้ว ทำรายการนี้ได้เฉพาะเดือนที่ยังเปิดอยู่", en: "This month is closed. This action needs an open month." },
  MANUAL_CLOSE_NOT_ALLOWED: { th: "ปิดเดือนได้ในวันสุดท้ายของเดือน หากยังไม่ได้ปิด", en: "You can close an open month on its last day." },
  SUMMARY_INCOMPLETE: { th: "กรอกยอดต้นเดือน รายรับ และยอดสิ้นเดือนให้ครบ", en: "Add the opening balance, income, and closing balance." },
  SUMMARY_INCONSISTENT: { th: "ยอดรายจ่ายยังไม่ตรงกัน ตรวจยอดรวมและรายการที่ยืนยัน", en: "Spending doesn’t add up yet. Check the total and confirmed items." },
  DETAIL_ALREADY_CONFIRMED: { th: "รายการนี้ยืนยันแล้ว โหลดข้อมูลล่าสุดเพื่อดูยอด", en: "This item is already confirmed. Refresh to see the amount." },
  SETUP_ITEM_CONFIRMED: { th: "ยกเลิกการยืนยันรายการนี้ก่อนแก้ไข", en: "Undo this item’s confirmation before editing." },
  REVISION_REQUIRED: { th: "โหลดข้อมูลล่าสุดก่อนบันทึกอีกครั้ง", en: "Refresh before saving again." },
  INTERNAL_ERROR: { th: "ทำรายการไม่สำเร็จ ลองอีกครั้ง", en: "Something went wrong. Please try again." },
  SERVICE_UNAVAILABLE: { th: "เชื่อมต่อไม่ได้ ลองอีกครั้งในอีกสักครู่", en: "Can’t connect right now. Try again shortly." },
};

const fields: Record<string, { th: string; en: string }> = {
  email: { th: "กรอกอีเมลให้ถูกต้อง", en: "Enter a valid email." },
  phone: { th: "กรอกเบอร์มือถือไทยให้ถูกต้อง", en: "Enter a valid Thai mobile number." },
  dateOfBirth: { th: "เลือกวันเกิดที่ถูกต้องและไม่ใช่วันในอนาคต", en: "Choose a valid date of birth that isn’t in the future." },
  profile: { th: "เก็บอีเมลหรือเบอร์มือถือไว้อย่างน้อยหนึ่งช่องทางเพื่อเข้าสู่ระบบ", en: "Keep at least one email or mobile number to sign in." },
  name: { th: "ตั้งชื่อรายการ 1–200 ตัวอักษร", en: "Use an item name of 1–200 characters." },
  observedOn: { th: "เลือกวันที่อยู่ในช่วงที่ติดตามของเดือนนี้", en: "Choose a date within this month’s tracked period." },
  amount: { th: "กรอกยอดเงินตั้งแต่ 0 และทศนิยมไม่เกิน 2 ตำแหน่ง", en: "Enter an amount of 0 or more, with up to 2 decimal places." },
  fixedAmount: { th: "ตรวจยอดคงที่ของรายการนี้", en: "Check this item’s fixed amount." },
};

export function localizedError(reason: unknown, locale: Locale): string {
  if (reason instanceof ApiClientError) {
    if (reason.code === "INVALID_INPUT" && reason.field && fields[reason.field]) return fields[reason.field][locale];
    return (errors[reason.code] ?? errors.INTERNAL_ERROR)[locale];
  }
  return errors.SERVICE_UNAVAILABLE[locale];
}
