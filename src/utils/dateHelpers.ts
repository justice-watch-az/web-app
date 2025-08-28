/**
 * Date comparison utilities for case filtering
 */

/**
 * Check if a case date is upcoming (today or future)
 * @param caseDate - The date string from the case (next_hearing)
 * @returns true if the date is today or in the future, false otherwise
 */
export const isUpcomingCase = (caseDate: string | null | undefined): boolean => {
  // Handle null/undefined dates - show these cases by default
  if (!caseDate) return true;
  
  try {
    // Get today at midnight (start of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Parse the case date and set to midnight
    const hearing = new Date(caseDate);
    
    // Check if date is valid
    if (isNaN(hearing.getTime())) {
      console.warn(`Invalid date format: ${caseDate}`);
      return true; // Show cases with invalid dates rather than hiding them
    }
    
    hearing.setHours(0, 0, 0, 0);
    
    // Return true if hearing date is today or in the future
    return hearing >= today;
  } catch (error) {
    console.error(`Error parsing date: ${caseDate}`, error);
    return true; // Show cases on error rather than hiding them
  }
};

/**
 * Format a date for display (if not already exported from dataTransforms)
 */
export const formatDateDisplay = (date: string | null | undefined): string => {
  if (!date) return 'No date';
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid date';
    
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return 'Invalid date';
  }
};