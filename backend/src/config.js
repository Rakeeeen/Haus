// The one channel the dashboard-control panel (/bommy /water /focus /finance)
// operates in. Also the anchor channel used to resolve which guild to
// register those slash commands into.
export const CONTROL_CHANNEL_ID = process.env.DISCORD_CONTROL_CHANNEL_ID || '1501292671753523371';

// Where what a guest does in Haus (signing in, adding or moving a task, a comment) is told, as it happens.
export const ACTIVITY_CHANNEL_ID = process.env.DISCORD_ACTIVITY_CHANNEL_ID || '1569687853376741386';
