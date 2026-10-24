import { formatDateString, isValidDateString } from "../../../utils/dates.js";

export interface StudentReportFields {
  studentNo: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  sex: string;
}

export function ageAsOf(birthDate: Date | string | null, asOf: string): number | null {
  if (birthDate === null) return null;
  const birth = formatDateString(birthDate);
  if (!isValidDateString(asOf) || !isValidDateString(birth) || birth > asOf) return null;
  const [birthYear, birthMonth, birthDay] = birth.split("-").map(Number);
  const [year, month, day] = asOf.split("-").map(Number);
  return year - birthYear - (month < birthMonth || (month === birthMonth && day < birthDay) ? 1 : 0);
}
