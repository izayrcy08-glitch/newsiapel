export const mergeAttendanceWithPeople = (attendance = {}, people = []) => {
  const merged = {};
  for (const person of people) {
    merged[person.id] = attendance?.[person.id] || { status: null, jamHadir: null };
  }
  return merged;
};
