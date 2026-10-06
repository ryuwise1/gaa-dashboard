/**
 * 회의 표기 — 내부 번호(no)는 1부터 이어지는 정수로 두고(체결·회의록 연결의 키라 바꾸지 않는다),
 * 화면에는 기수를 붙여 보인다. 1~6은 19기(19-1…19-6), 7부터는 20기 신입 합류 후(20-1…).
 */
export const LAST_NO_OF_19 = 6;

export function meetingLabel(no: number): string {
  return no <= LAST_NO_OF_19 ? `19-${no}` : `20-${no - LAST_NO_OF_19}`;
}
