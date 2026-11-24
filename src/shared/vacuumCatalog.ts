export const VACUUM_MODELS={
 'vacuum-xiaomi':{name:'Xiaomi Robot Vacuum S20',price:19900,clean:85,speed:1.05,width:.50,depth:.75,height:.16,spec:'Сухая уборка · обычная станция'},
 'vacuum-roborock':{name:'Roborock Q8 Max+',price:44900,clean:95,speed:1.35,width:.55,depth:.80,height:.58,spec:'Сухая и влажная уборка · самоочистка'},
 'vacuum-dreame':{name:'Dreame X50 Ultra',price:89900,clean:100,speed:1.65,width:.61,depth:.85,height:.64,spec:'Сухая и влажная уборка · комплексная станция'},
} as const;
export type VacuumSku=keyof typeof VACUUM_MODELS;
export const isVacuumSku=(id:unknown):id is VacuumSku=>typeof id==='string'&&Object.hasOwn(VACUUM_MODELS,id);