import { UpgradeDef } from './types';

export const UPGRADE_CATALOG: UpgradeDef[] = [
  {
    id: 'twin_aperture',
    name: 'Meriam Kembar',
    category: 'Persenjataan',
    effectText: '+1 Peluru · +10% Laju Tembak',
    description: 'Memecah tembakan utama menjadi kipas beruntun dengan pengisian lebih cepat.',
  },
  {
    id: 'capacitor_thrusters',
    name: 'Pendorong Kapasitor',
    category: 'Propulsi',
    effectText: '-28% Jeda Dash · +14% Kecepatan',
    description: 'Jet manuver berdaya tinggi mempercepat gerak menghindar di udara.',
  },
  {
    id: 'solar_magnet',
    name: 'Kolektor Surya',
    category: 'Reaktor',
    effectText: '+120% Jarak Tarik · +25% Energi',
    description: 'Menarik pecahan surya dari kejauhan dan menggandakan pengisian reaktor.',
  },
  {
    id: 'reinforced_bulkhead',
    name: 'Lambung Kuningan',
    category: 'Pertahanan',
    effectText: '+30 Maks Lambung · Pulih +45',
    description: 'Melapisi badan pesawat dengan baja kuningan sekaligus memperbaiki kerusakan.',
  },
  {
    id: 'ricochet_core',
    name: 'Inti Pantulan',
    category: 'Persenjataan',
    effectText: '+1 Pantulan Batas Arena',
    description: 'Peluru memantul di tepi sektor untuk menghantam musuh dua kali.',
  },
  {
    id: 'overdrive_surge',
    name: 'Gelombang Surya',
    category: 'Reaktor',
    effectText: '+2,5d Overdrive · 2x Ledakan',
    description: 'Memperpanjang durasi Overdrive dan menggandakan daya kejut awal.',
  },
  {
    id: 'high_velocity',
    name: 'Akselerator Rel',
    category: 'Persenjataan',
    effectText: '+28% Laju Peluru · +22% Daya Hantam',
    description: 'Kumparan elektromagnetik melontarkan proyektil lebih cepat dan mematikan.',
  },
  {
    id: 'aegis_pulse',
    name: 'Pulsa Pelindung',
    category: 'Pertahanan',
    effectText: 'Dash Menghapus Peluru Musuh',
    description: 'Setiap manuver dash memancarkan cincin energi yang melenyapkan tembakan lawan.',
  },
];

export function pickUpgradeChoices(count = 3): UpgradeDef[] {
  const pool = [...UPGRADE_CATALOG];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
