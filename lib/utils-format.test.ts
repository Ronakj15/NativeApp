import { formatDate, formatTime, formatDateTime, pct, DAYS } from './utils-format'

describe('utils-format', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('formatDate', () => {
    it('should format a string date using Date.prototype.toLocaleDateString with correct options', () => {
      const toLocaleDateStringSpy = jest.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('mocked-date')
      const result = formatDate('2023-10-15T12:00:00Z')

      expect(toLocaleDateStringSpy).toHaveBeenCalledWith(undefined, { weekday: "short", month: "short", day: "numeric" })
      expect(result).toBe('mocked-date')

      toLocaleDateStringSpy.mockRestore()
    })

    it('should format a Date object using Date.prototype.toLocaleDateString with correct options', () => {
      const toLocaleDateStringSpy = jest.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('mocked-date-obj')
      const date = new Date('2023-10-15T12:00:00Z')
      const result = formatDate(date)

      expect(toLocaleDateStringSpy).toHaveBeenCalledWith(undefined, { weekday: "short", month: "short", day: "numeric" })
      expect(result).toBe('mocked-date-obj')

      toLocaleDateStringSpy.mockRestore()
    })
  })

  describe('formatTime', () => {
    it('should format a string time using Date.prototype.toLocaleTimeString with correct options', () => {
      const toLocaleTimeStringSpy = jest.spyOn(Date.prototype, 'toLocaleTimeString').mockReturnValue('mocked-time')
      const result = formatTime('2023-10-15T14:30:00Z')

      expect(toLocaleTimeStringSpy).toHaveBeenCalledWith(undefined, { hour: "numeric", minute: "2-digit" })
      expect(result).toBe('mocked-time')

      toLocaleTimeStringSpy.mockRestore()
    })

    it('should format a Date object time using Date.prototype.toLocaleTimeString with correct options', () => {
      const toLocaleTimeStringSpy = jest.spyOn(Date.prototype, 'toLocaleTimeString').mockReturnValue('mocked-time-obj')
      const date = new Date('2023-10-15T14:30:00Z')
      const result = formatTime(date)

      expect(toLocaleTimeStringSpy).toHaveBeenCalledWith(undefined, { hour: "numeric", minute: "2-digit" })
      expect(result).toBe('mocked-time-obj')

      toLocaleTimeStringSpy.mockRestore()
    })
  })

  describe('formatDateTime', () => {
    it('should combine formatDate and formatTime with a bullet separator', () => {
      const toLocaleDateStringSpy = jest.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('mock-date')
      const toLocaleTimeStringSpy = jest.spyOn(Date.prototype, 'toLocaleTimeString').mockReturnValue('mock-time')

      const dateStr = '2023-10-15T14:30:00Z'
      const result = formatDateTime(dateStr)

      expect(result).toBe('mock-date • mock-time')

      toLocaleDateStringSpy.mockRestore()
      toLocaleTimeStringSpy.mockRestore()
    })
  })

  describe('pct', () => {
    it('should calculate the percentage correctly', () => {
      expect(pct(50, 100)).toBe(50)
      expect(pct(1, 3)).toBe(33)
      expect(pct(2, 3)).toBe(67)
    })

    it('should return 0 when total is 0 to avoid division by zero', () => {
      expect(pct(50, 0)).toBe(0)
    })

    it('should handle value being 0', () => {
      expect(pct(0, 100)).toBe(0)
    })
  })

  describe('DAYS', () => {
    it('should be an array of short day names starting with Sunday', () => {
      expect(DAYS).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"])
    })
  })
})
