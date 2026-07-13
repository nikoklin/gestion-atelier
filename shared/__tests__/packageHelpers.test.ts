import { describe, it, expect } from 'vitest';
import {
  isPackageExpired,
  minutesToHoursAndMinutes,
  formatMinutesAsHours,
  getPackageMinutes,
} from '../packageHelpers';

describe('packageHelpers', () => {
  describe('isPackageExpired', () => {
    it('should return true if expired by date', () => {
      const pastDate = new Date('2020-01-01');
      expect(isPackageExpired(pastDate, 0, 900)).toBe(true);
    });

    it('should return true if exhausted by hours', () => {
      const futureDate = new Date('2030-01-01');
      expect(isPackageExpired(futureDate, 900, 900)).toBe(true);
    });

    it('should return false if not expired and not exhausted', () => {
      const futureDate = new Date('2030-01-01');
      expect(isPackageExpired(futureDate, 500, 900)).toBe(false);
    });

    it('should return true if both expired by date and exhausted', () => {
      const pastDate = new Date('2020-01-01');
      expect(isPackageExpired(pastDate, 900, 900)).toBe(true);
    });

    it('should handle edge case: usedHours equals totalHours', () => {
      const futureDate = new Date('2030-01-01');
      expect(isPackageExpired(futureDate, 900, 900)).toBe(true);
    });

    it('should handle edge case: endDate is today', () => {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      expect(isPackageExpired(today, 0, 900)).toBe(false);
    });
  });

  describe('minutesToHoursAndMinutes', () => {
    it('should convert 542 minutes to 9h02', () => {
      expect(minutesToHoursAndMinutes(542)).toEqual({ hours: 9, minutes: 2 });
    });

    it('should convert 900 minutes to 15h00', () => {
      expect(minutesToHoursAndMinutes(900)).toEqual({ hours: 15, minutes: 0 });
    });

    it('should handle 0 minutes', () => {
      expect(minutesToHoursAndMinutes(0)).toEqual({ hours: 0, minutes: 0 });
    });

    it('should handle 59 minutes (less than 1 hour)', () => {
      expect(minutesToHoursAndMinutes(59)).toEqual({ hours: 0, minutes: 59 });
    });

    it('should handle 60 minutes (exactly 1 hour)', () => {
      expect(minutesToHoursAndMinutes(60)).toEqual({ hours: 1, minutes: 0 });
    });

    it('should handle 1441 minutes (24h01)', () => {
      expect(minutesToHoursAndMinutes(1441)).toEqual({ hours: 24, minutes: 1 });
    });
  });

  describe('formatMinutesAsHours', () => {
    it('should format 542 minutes as "9h02"', () => {
      expect(formatMinutesAsHours(542)).toBe('9h02');
    });

    it('should format 900 minutes as "15h"', () => {
      expect(formatMinutesAsHours(900)).toBe('15h');
    });

    it('should format 0 minutes as "0h"', () => {
      expect(formatMinutesAsHours(0)).toBe('0h');
    });

    it('should format 59 minutes as "0h59"', () => {
      expect(formatMinutesAsHours(59)).toBe('0h59');
    });

    it('should format 60 minutes as "1h"', () => {
      expect(formatMinutesAsHours(60)).toBe('1h');
    });

    it('should format 1441 minutes as "24h01"', () => {
      expect(formatMinutesAsHours(1441)).toBe('24h01');
    });
  });

  describe('getPackageMinutes', () => {
    it('should return 900 minutes for "15h_8w"', () => {
      expect(getPackageMinutes('15h_8w')).toBe(900);
    });

    it('should return 1800 minutes for "30h_8w"', () => {
      expect(getPackageMinutes('30h_8w')).toBe(1800);
    });

    it('should return 1800 minutes for "30h_4w"', () => {
      expect(getPackageMinutes('30h_4w')).toBe(1800);
    });

    it('should return 10800 minutes for "180h_6m"', () => {
      expect(getPackageMinutes('180h_6m')).toBe(10800);
    });

    it('should throw error for invalid package type', () => {
      expect(() => getPackageMinutes('invalid')).toThrow('Invalid package type');
    });
  });
});
