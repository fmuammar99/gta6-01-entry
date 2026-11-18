// The story: three chained missions for Raka, a night courier in Teluk
// Senja. Each mission is a list of stages; a stage is done when the player
// reaches its marker (or, for the warehouse, clears its thugs). Completing
// a mission pays cash, shows a banner and starts the next one. The module
// is pure state: it never draws and never touches the world directly.
import { REWARD } from './config.js';

export const MISSION_NAMES = [
  'Paket untuk Mira',
  'Razia di Jembatan',
  'Tagihan Terakhir',
];

const DIALOGUE = {
  m1_start: [
    'MIRA: Raka, paket ini harus sampai sebelum tengah malam.',
    'RAKA: Santai. Aku kenal semua jalan di Teluk Senja.',
  ],
  m1_pickup: ['RAKA: Paket di tangan. Sekarang antar ke flat timur.'],
  m1_done: ['PENERIMA: Tepat waktu. Ini upahmu, kurir.', 'MIRA: Kerja bagus. Tapi hati-hati — ada razia malam ini.'],
  m2_start: ['MIRA: Razia di jembatan! Polisi di mana-mana. Ke garasi, cepat!'],
  m2_done: ['RAKA: Lolos. Mereka tidak akan menemukan garasi ini.'],
  m3_start: [
    'MIRA: Utang terakhir. Tiga orang Darto menunggumu di gudang ikan.',
    'RAKA: Kalau begitu, gudang itu yang bayar malam ini.',
  ],
  m3_fight: ['DARTO: Itu dia! Jangan biarkan dia keluar hidup-hidup!'],
  m3_done: ['RAKA: Lunas. Teluk Senja akhirnya tenang malam ini.'],
};

export function createMissions(city) {
  const L = city.landmarks;
  const missions = [
    {
      name: MISSION_NAMES[0],
      intro: 'Ambil paket di Warung Kopi Mira, lalu antar ke flat timur.',
      stages: [
        { id: 'pickup', label: 'Ambil paket di Warung Kopi Mira', target: L.cafe, radius: 56, say: 'm1_pickup' },
        { id: 'deliver', label: 'Antar paket ke flat timur', target: L.drop, radius: 56, say: null },
      ],
      reward: REWARD.m1,
      doneSay: 'm1_done',
    },
    {
      name: MISSION_NAMES[1],
      intro: 'Razia! Polisi mengejarmu. Kabur ke garasi dan hilangkan mereka.',
      stages: [
        { id: 'escape', label: 'Kabur ke garasi — jangan sampai tertangkap', target: L.safehouse, radius: 64, say: null },
      ],
      reward: REWARD.m2,
      doneSay: 'm2_done',
    },
    {
      name: MISSION_NAMES[2],
      intro: 'Tagih utang di gudang ikan. Tiga orang Darto menjaga tempat itu.',
      stages: [
        { id: 'warehouse', label: 'Pergi ke gudang ikan tua', target: L.warehouse, radius: 70, say: 'm3_fight' },
        { id: 'fight', label: 'Kalahkan tiga anak buah Darto', target: L.warehouse, radius: 240, say: null },
        { id: 'return', label: 'Kembali ke Mira di alun-alun', target: L.miraHome, radius: 56, say: null },
      ],
      reward: REWARD.m3,
      doneSay: 'm3_done',
    },
  ];

  const state = {
    index: 0,
    stage: 0,
    done: 0,
    allDone: false,
    // Dialogue lines waiting to be shown, with a per-line timer handled by the game.
    sayQueue: [],
    banner: null,
  };

  function current() {
    return state.allDone ? null : missions[state.index];
  }

  function currentStage() {
    const m = current();
    return m ? m.stages[state.stage] : null;
  }

  function objective() {
    if (state.allDone) return 'Semua misi selesai — Teluk Senja milikmu.';
    const m = current();
    return `${m.name}: ${m.stages[state.stage].label}`;
  }

  function say(key) {
    const lines = DIALOGUE[key];
    if (lines) for (const line of lines) state.sayQueue.push(line);
  }

  function start() {
    state.index = 0;
    state.stage = 0;
    state.done = 0;
    state.allDone = false;
    say('m1_start');
  }

  /** Advance one stage; returns 'mission' when a mission completes, 'stage' otherwise, null when nothing. */
  function advance() {
    const m = current();
    if (!m) return null;
    const stage = m.stages[state.stage];
    if (stage.say) say(stage.say);
    state.stage += 1;
    if (state.stage >= m.stages.length) {
      const reward = m.reward;
      if (m.doneSay) say(m.doneSay);
      state.done += 1;
      state.index += 1;
      state.stage = 0;
      if (state.index >= missions.length) {
        state.allDone = true;
        state.banner = { title: 'SEMUA MISI SELESAI', sub: `Teluk Senja akhirnya tenang — Raka menang.` };
      } else {
        const next = missions[state.index];
        state.banner = { title: 'MISI SELESAI', sub: `${m.name} — +$${reward} · Misi berikutnya: ${next.name}` };
        const startKey = state.index === 1 ? 'm2_start' : state.index === 2 ? 'm3_start' : null;
        if (startKey) say(startKey);
      }
      return { kind: 'mission', reward, name: m.name };
    }
    return { kind: 'stage' };
  }

  return { state, missions, current, currentStage, objective, say, start, advance };
}
