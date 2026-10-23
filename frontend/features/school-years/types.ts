export interface Term {
  id: string; schoolYearId: string; name: string; termNumber: number; startDate: string; endDate: string;
}
export interface SchoolYear {
  id: string; name: string; startDate: string; endDate: string; isCurrent: boolean; terms: Term[];
}
export interface SchoolYearInput { name: string; startDate: string; endDate: string }
export interface TermInput { name: string; startDate: string; endDate: string }
