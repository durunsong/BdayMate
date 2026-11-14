declare module 'lunar-javascript' {
  interface SolarDate {
    toYmd(): string;
    getLunar(): LunarDate;
  }
  interface LunarDate {
    getYear(): number;
    getMonth(): number;
    getDay(): number;
    getSolar(): SolarDate;
  }
  interface LunarMonthValue {
    getDayCount(): number;
  }
  export const Solar: {
    fromYmd(year: number, month: number, day: number): SolarDate;
  };
  export const Lunar: {
    fromYmd(year: number, month: number, day: number): LunarDate;
  };
  export const LunarMonth: {
    fromYm(year: number, month: number): LunarMonthValue | null;
  };
}
