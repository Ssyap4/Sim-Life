export const SPEAKER_MODELS={
 'speaker-alice':{name:'Яндекс Станция 3',assistant:'Алиса',price:24990,width:.22,depth:.22,height:.29,gain:.36,range:4.5},
 'speaker-google':{name:'Google Home Speaker',assistant:'Google Assistant',price:19990,width:.20,depth:.20,height:.22,gain:.30,range:3.8},
 'speaker-apple':{name:'Apple HomePod',assistant:'Siri',price:39990,width:.23,depth:.23,height:.25,gain:.46,range:5.5},
} as const;
export type SpeakerSku=keyof typeof SPEAKER_MODELS;
export const isSpeakerSku=(id:unknown):id is SpeakerSku=>typeof id==='string'&&Object.hasOwn(SPEAKER_MODELS,id);
export const MUSIC_GENRES={lofi:'Lo-Fi',pop:'Pop',house:'Deep House',hiphop:'Hip-Hop',rock:'Rock',chill:'Chillout',romantic:'Romantic',piano:'Piano'} as const;
export type MusicGenre=keyof typeof MUSIC_GENRES;
export const isMusicGenre=(id:unknown):id is MusicGenre=>typeof id==='string'&&Object.hasOwn(MUSIC_GENRES,id);
const titles={lofi:['Coffee at dawn','Rain on glass'],pop:['Bright side','City lights'],house:['After midnight','Ocean drive'],hiphop:['Low rider','Late train'],rock:['Open road','Northern lights'],chill:['Blue horizon','Quiet coast'],romantic:['Two hearts','Evening for two'],piano:['First snow','Soft morning']} as const;
export type SpeakerTrackId=`speaker-track-${MusicGenre}-${0|1}`;
export const TRACK_MINUTES=16;
export const SPEAKER_TRACKS=(Object.keys(MUSIC_GENRES) as MusicGenre[]).flatMap(genre=>titles[genre].map((title,index)=>({id:`speaker-track-${genre}-${index}` as SpeakerTrackId,genre,title})));
export const isSpeakerTrack=(id:unknown):id is SpeakerTrackId=>SPEAKER_TRACKS.some(t=>t.id===id);
export const trackInfo=(id:SpeakerTrackId)=>SPEAKER_TRACKS.find(t=>t.id===id)!;
