
"""Add only new garments to the approved remake source; never rebuild face or skeleton."""
import sys
from pathlib import Path
from math import sin, cos, pi
import bpy
ART=Path(__file__).resolve().parent
sys.path.insert(0,str(ART))
from model import Resident
from wardrobe import top_mesh, lower_mesh, sneakers
from mesh import Mesh, rgb, blend, solid, skin, profile, ramp, steps
from export import export

NEW={
 'vlad':[
 ('trackNavy','304c78','eae6d9','303945','track','olympic','e9e3d6','577296','canvas'),
 ('trackForest','45634f','303639','333e36','joggers','olympic','68715e','e6d9c6','high'),
 ('teeRetro','e4ded0','b05e49','455d76','jeans','graphic','a83f37','f0dfc8','canvas'),
 ('teeBlack','25282c','45474d','c5b7a0','trousers','relaxed','343940','d8d8d2','runner'),
 ('robeNavy','344868','50698a','344868','robeShort','robe','354969','adb8ca','slipper'),
 ('robeGrey','85878d','565961','85878d','robeShort','robe','64646a','c2c0c3','slipper'),
 ],
 'alina':[
 ('pajamaRose','e9b1bf','f8e6e9','d79aaa','shorts','pajama','e2a8b8','f8e6e9','slipper'),
 ('pajamaMint','b5d8ce','f3f1df','91bdb4','shorts','pajama','a6cfc3','e8efe7','slipper'),
 ('pajamaCream','f0e2d0','d9b8a5','e4a998','shorts','relaxed','eac3ad','f5e1d2','slipper'),
 ('silkBerry','9d3655','e4aaba','a33e60','shorts','satin','bd6983','f1ced5','slipper'),
 ('silkMidnight','293c60','a9b5cf','354567','shorts','satin','e3d8d0','f2e7de','slipper'),
 ('datePearl','f5e6db','bca49a','743b4d','trousers','fitted','e7ded5','985967','canvas'),
 ]}
def slippers(r,color,accent):
    m=Mesh('Soft house slippers','Footwear',.85)
    for side,suffix in ((-1,'L'),(1,'R')):
        x=side*.111;ankle='Ankle'+suffix
        sole=[(.004,.065,.132,.042),(.019,.071,.139,.043),(.035,.071,.139,.043)]
        m.lathe(sole,(x,0,0),lambda t,a:blend(color,accent,.22*(1-t)),lambda _:solid(ankle),rings=4,sides=22)
        foot=[(.033,.060,.122,.040),(.059,.060,.107,.035),(.089,.043,.076,.008),(.111,.039,.043,-.004)]
        m.lathe(foot,(x,0,0),lambda t,a:r.portrait.base,lambda _:solid(ankle),rings=9,sides=18)
        # Rounded closed toe, exposed heel and contrasting rim.
        cap=[(.028,.066,.081,.090),(.048,.067,.078,.091),(.078,.056,.065,.094),(.093,.037,.044,.094),(.098,.010,.012,.094)]
        m.lathe(cap,(x,0,0),lambda t,a:blend(color,accent,.12*max(0,cos(a))),lambda _:solid(ankle),rings=10,sides=22)
        m.cord([((x+.060*sin(a),.048+.036*max(0,cos(a)),.039-.018*cos(a)),.004) for a in [2*pi*t for t in steps(16)]],accent,solid(ankle),sides=5)
    return m

def special_top(r,look,top,trim,cut):
    if cut=='robe':
        m=top_mesh(r,look,top,trim,'robe')
        h,s,n=r.hip,r.shoulder,r.neck
        # Continuous flared hem from top_mesh, with broad tie and lapels.
        belt=[((.186*sin(a),h+.104,.124*cos(a)-.006),.009) for a in [2*pi*t for t in steps(28)]]
        m.cord(belt,trim,skin('Pelvis','Chest',.5),sides=7)
        for side in (-1,1):
            m.cord([((side*.073,n-.018,.065),.011),((side*.104,s-.061,.107),.014),((side*.055,s-.171,.135),.012),((0,h+.122,.127),.008)],trim,solid('Chest'),sides=6)
        for side in (-1,1):
            m.cord([((0,h+.105,.141),.012),((side*.060,h+.064,.148),.010),((side*.047,h-.007,.150),.007)],trim,solid('Pelvis'),sides=6)
        return m
    if cut in ('pajama','satin'):
        m=top_mesh(r,look,top,trim,'cap' if cut=='satin' else 'classic')
        h,s,n=r.hip,r.shoulder,r.neck
        m.roughness=.48 if cut=='satin' else .89
        if cut=='satin':m.material='Satin pigment'
        # Decorative contrasting piping, short sleeves, and small front bow/buttons.
        for yy in (h+.16,h+.23,h+.30):
            m.cord([((0,yy,.128),.006),((0,yy+.004,.130),.006)],trim,solid('Chest'),sides=6)
        if cut=='satin':
            for side in (-1,1):
                m.cord([((0,s-.117,.132),.004),((side*.045,s-.101,.131),.006),((side*.025,s-.141,.136),.004),((0,s-.117,.132),.004)],trim,solid('Chest'),sides=5)
        return m
    return top_mesh(r,look,top,trim,cut)

def main():
    role=sys.argv[sys.argv.index('--')+1]
    r=Resident(role);src=ART/'remake'/(role+'.blend')
    bpy.ops.wm.open_mainfile(filepath=str(src))
    rig=bpy.data.objects['Resident']
    for look,top,trim,bottom,lower,cut,shoe,accent,kind in NEW[role]:
        for child in list(rig.children):
            if child.get('garmentId','').startswith(role+'-'+look+'-'):
                bpy.data.objects.remove(child,do_unlink=True)
        r.garment(rig,special_top(r,look,rgb(top),rgb(trim),cut),'upper',look)
        r.garment(rig,lower_mesh(r,look,rgb(bottom),lower),'lower',look)
        r.garment(rig,slippers(r,rgb(shoe),rgb(accent)) if kind=='slipper' else sneakers(r,rgb(shoe),rgb(accent),kind),'footwear',look)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(src),compress=True)
    export(ART.parents[1]/'src/assets/characters/remake'/(role+'.glb'))
if __name__=='__main__':main()
