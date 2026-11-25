"""Build new exterior meshes around the approved armature and game wardrobe."""

import argparse
import sys
from math import cos, pi, sin
from pathlib import Path

import bpy
from mathutils import Quaternion

ART=Path(__file__).resolve().parent
sys.dont_write_bytecode=True
sys.path.insert(0,str(ART))
from export import export
from mesh import Mesh, bell, blend, rgb, solid, skin
from remake_hair import build_hair
from remake_portrait import Sculpt, bezier_path


def neck_and_hands(sculpt, rig, exposed):
    f=sculpt.woman
    neck=1.445 if f else 1.509
    skin_color=sculpt.base
    exposed.lathe([(neck-.029,.071,.065,-.013),(neck+.015,.061 if f else .067,.063,-.014),
        (neck+.061,.053 if f else .065,.054,-.014),(sculpt.height-.153,.055 if f else .064,.061,-.002),
        (sculpt.height-.122,.068,.065,-.010)],(0,0,0),
        lambda t,a:blend(skin_color,rgb('b67d65'),.32*max(0,-cos(a))+.11*bell((t-.6)/.40)),
        lambda t:skin('Chest','Head',(t-.41)/.51),rings=21,sides=37)
    lower=Mesh('Forearms','Skin and trim Forearms',.78)
    for side,suffix in ((-1,'L'),(1,'R')):
        wrist=next(b for b in rig.data.bones if b.name=='Wrist'+suffix)
        elbow=rig.data.bones['Elbow'+suffix]
        shoulder=rig.data.bones['Arm'+suffix]
        x,y=wrist.head_local.x,wrist.head_local.z
        ey=elbow.head_local.z
        end=shoulder.head_local.z-.116
        col=lambda t,a:blend(skin_color,rgb('b47c69'),.19*(1-t)*max(0,-cos(a)))
        joint=solid('Wrist'+suffix)
        def arm_bind(t):
            height=y+(end-y)*t
            if height<y+.059:
                return skin('Wrist'+suffix,'Elbow'+suffix,(height-y)/.059)
            return skin('Elbow'+suffix,'Arm'+suffix,(height-ey+.082)/.166)
        lower.lathe([(y,.021 if f else .023,.024,0),(y+.049,.028,.027,.002),
                      (ey-.113,.037,.034,.003),(ey-.042,.040,.036,.001),(ey,.042,.041,-.001),
                      (ey+.066,.045,.042,-.002),(end,.046 if f else .050,.045,-.004)],
                    (x,0,0),col,arm_bind,rings=30,sides=24)
        exposed.lathe([(-.069,.025,.012,.012),(-.053,.030 if f else .034,.020,.010),
                       (-.034,.029 if f else .033,.021,.005),(-.015,.026,.023,.001),(.014,.020,.023,0)],
                      (x,y,0),col,lambda _:joint,rings=16,sides=23)
        for i,(offset,length) in enumerate([(-.021,.043),(-.007,.054),(.008,.050),(.022,.036)]):
            cx=x+side*offset
            top=-.055+abs(i-1)*.002
            tip=top-length
            drift=side*(.003 if i>1 else -.002)
            def bend(px,py,pz,angle,t):
                return px+drift*(1-t)**2,py,pz+.010*(1-t)**2
            expanded=.0010 if not f else 0
            exposed.lathe([(tip,.0016,.003,.024),(tip+.005,.0055+expanded,.0067,.025),
                         (tip+.017,.0068+expanded,.0072,.018),(top-.016,.007+expanded,.008,.011),
                         (top-.007,.0072+expanded,.009,.007),(top,.0079+expanded,.009,.005)],
                         (cx,y,0),col,lambda _:joint,rings=13,sides=12,warp=bend)
            exposed.cord([((cx+drift,y+tip+.005,.028),.0028),((cx+drift*.75,y+tip+.010,.027),.0025)],
                          blend(skin_color,rgb('f3d1b3'),.35),joint,sides=6,thickness=.55)
        curve=list(bezier_path([(x-side*.014,y-.021,.004),(x-side*.026,y-.031,.014),
               (x-side*.033,y-.049,.027),(x-side*.033,y-.059,.030)],14))
        exposed.cord([(p,.0115*(1-i/len(curve)*.62)) for i,p in enumerate(curve)],skin_color,joint,sides=12)
    return lower


def hoop(sculpt):
    jewelry=Mesh('Small gold hoops','Gold earrings',.31)
    for s in (-1,1):
        points=[]
        for i in range(30):
            angle=i*2*pi/29
            points.append((sculpt.xyz(s*.132+s*.011*sin(angle),-.098+.015*cos(angle),.037+.003*sin(angle)),.0022))
        jewelry.cord(points,rgb('d29b54'),solid('Head'),sides=8)
    return jewelry


def blink(face,character):
    scene=bpy.context.scene
    scene.render.fps=30
    scene.frame_start=1
    scene.frame_end=181
    data=face.data.shape_keys
    data.animation_data_create()
    old=bpy.data.actions.get('Blink')
    if old:
        bpy.data.actions.remove(old)
    data.animation_data.action=bpy.data.actions.new('Blink')
    lids=data.key_blocks['CloseLids']
    first,second=(35,131) if character=='alina' else (79,152)
    for frame,value in [(1,0),(first,0),(first+3,1),(first+4,1),(first+8,0),
                 (second,0),(second+3,1),(second+8,0),(181,0)]:
        lids.value=value
        lids.keyframe_insert(data_path='value',frame=frame)
    scene.frame_set(1)


def rebuild(character, source, blender_output, game_output, textures):
    bpy.ops.wm.open_mainfile(filepath=str(source))
    rig=bpy.data.objects['Resident']
    eye=rig.data.bones['EyeR']
    sculpt=Sculpt(character,eye.head_local.z,eye.head_local.x)
    for child in list(rig.children):
        if child.type=='MESH' and not child.get('garmentId'):
            geometry=child.data
            bpy.data.objects.remove(child,do_unlink=True)
            if geometry.users==0:
                bpy.data.meshes.remove(geometry)
    for name in ('Complexion','Eyes','Hair pigment'):
        material=bpy.data.materials.get(name)
        if material and material.users==0:
            bpy.data.materials.remove(material)
    textures.mkdir(parents=True,exist_ok=True)
    face,eyes,skin_mesh=sculpt.build_face(textures)
    lower=neck_and_hands(sculpt,rig,skin_mesh)
    portrait=face.build(rig)
    portrait['remakePortrait']=True
    for mesh in (eyes,skin_mesh,build_hair(sculpt,textures)):
        mesh.build(rig)
    lower.build(rig)['bodyRegion']='forearms'
    if character=='alina':
        hoop(sculpt).build(rig)
    blink(portrait,character)
    bpy.context.preferences.filepaths.save_version=0
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                view=area.spaces.active
                view.region_3d.view_location=(0,0,1.54)
                view.region_3d.view_distance=1.01
                view.region_3d.view_rotation=Quaternion((1,0,0),pi/2)
                view.shading.type='MATERIAL'
    blender_output.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(blender_output),compress=True)
    export(game_output)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('character',choices=('alina','vlad'))
    parser.add_argument('--work',type=Path,help='Write all products to this alternate directory')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    id=args.character
    source=ART/(id+'.blend')
    art=args.work.resolve() if args.work else ART/'remake'
    game=args.work.resolve() if args.work else ART.parents[1]/'src/assets/characters/remake'
    rebuild(id,source,art/(id+'.blend'),game/(id+'.glb'),art/'textures')


if __name__=='__main__':
    main()
