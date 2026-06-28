export const DAY_LABELS = {
  monday: 'วันจันทร์',
  tuesday: 'วันอังคาร',
  wednesday: 'วันพุธ',
  thursday: 'วันพฤหัสบดี',
  friday: 'วันศุกร์'
};

export const colorTeams = [
  {
    id: 'maen',
    name: 'คณะแม้นนฤมิตร',
    shortName: 'แม้นนฤมิตร',
    colorName: 'สีม่วง',
    accentColor: '#7C3AED',
    softColor: '#F3E8FF',
    dutyDay: 'monday',
    username: 'maen'
  },
  {
    id: 'yaowaman',
    name: 'คณะเยาวมาลย์อุทิศ',
    shortName: 'เยาวมาลย์อุทิศ',
    colorName: 'สีน้ำเงิน',
    accentColor: '#2563EB',
    softColor: '#DBEAFE',
    dutyDay: 'tuesday',
    username: 'yaowaman'
  },
  {
    id: 'nipha',
    name: 'คณะนิภานภดล',
    shortName: 'นิภานภดล',
    colorName: 'สีแสด',
    accentColor: '#F97316',
    softColor: '#FFEDD5',
    dutyDay: 'wednesday',
    username: 'nipha'
  },
  {
    id: 'piyarat',
    name: 'คณะปิยราชบพิตร',
    shortName: 'ปิยราชบพิตร',
    colorName: 'สีชมพู',
    accentColor: '#EC4899',
    softColor: '#FCE7F3',
    dutyDay: 'thursday',
    username: 'piyarat'
  },
  {
    id: 'phanu',
    name: 'คณะภาณุรังษี',
    shortName: 'ภาณุรังษี',
    colorName: 'สีแดง',
    accentColor: '#DC2626',
    softColor: '#FEE2E2',
    dutyDay: 'friday',
    username: 'phanu'
  }
];

export const users = [
  {
    id: 'admin',
    username: 'admin',
    password: '1234',
    displayName: 'ผู้ดูแลระบบ',
    role: 'ADMIN',
    colorTeamId: null
  },
  ...colorTeams.map((team) => ({
    id: `president_${team.id}`,
    username: team.username,
    password: '1234',
    displayName: `ประธาน${team.name}`,
    role: 'PRESIDENT',
    colorTeamId: team.id
  }))
];

export function getTeam(teamId) {
  return colorTeams.find((team) => team.id === teamId) || null;
}

export function getTeamByDutyDay(dayKey) {
  return colorTeams.find((team) => team.dutyDay === dayKey) || null;
}
