"""Build the original Simba model in Blender and export its mobile rig."""
from math import cos, exp, pi, sin
from pathlib import Path
import sys

import bpy
from mathutils import Euler, Vector

art = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
sys.path.insert(0, str(art / 'characters'))
from export import export
from mesh import Mesh, blend, linear, profile, rgb, skin, solid, steps, xyz


bpy.ops.wm.read_factory_settings(use_empty=True)
bones = bpy.data.armatures.new('Simba skeleton')
rig = bpy.data.objects.new('Simba', bones)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
rig['character'] = 'simba'
rig.show_in_front = True
bpy.ops.object.mode_set(mode='EDIT')

def bone(name, anchor, parent=None):
    joint = bones.edit_bones.new(name)
    joint.head = xyz(anchor)
    joint.tail = joint.head + Vector((0, 0, .08))
    if parent:
        joint.parent = bones.edit_bones[parent]

bone('Root', (0,0,0))
bone('Pelvis', (0,.46,-.40), 'Root')
bone('Spine', (0,.47,-.13), 'Pelvis')
bone('Chest', (0,.49,.23), 'Spine')
bone('Neck', (0,.51,.31), 'Chest')
bone('Head', (0,.61,.48), 'Neck')
bone('Jaw', (0,.553,.50), 'Head')
tail = [(0,.48,-.52,.065),(.005,.52,-.67,.053),(.01,.585,-.83,.046),
        (.027,.64,-1.02,.036),(.055,.655,-1.19,.023),(.075,.685,-1.33,.007)]
for i, segment in enumerate(tail):
    bone(f'Tail{i}',segment[:3],f'Tail{i-1}' if i else 'Pelvis')
for lateral,tag in ((-1,'L'),(1,'R')):
    bone('Ear'+tag,(lateral*.095,.696,.441),'Head')
    bone('Eye'+tag,(lateral*.086,.631,.578),'Head')
    for front in (True,False):
        name = ('Fore' if front else 'Hind')+tag
        x = lateral*(.105 if front else .115)
        z = .25 if front else -.388
        knee = (x,.266,z+(-.028 if front else .090))
        ankle = (x,.085,z+(.011 if front else -.036))
        bone(name,(x,.435 if front else .454,z),'Chest' if front else 'Pelvis')
        bone(name+'Knee',knee,name)
        bone(name+'Paw',ankle,name+'Knee')
bpy.ops.object.mode_set(mode='OBJECT')

fur = Mesh('Short tabby coat','Ginger tabby',.83)
eyes = Mesh('Iris, cornea and pupil','Eyes',.30)
ginger, copper, pale = map(rgb,('ce854d','945031','f4d3a3'))
cream = rgb('f3d4ad')

def point(p, color, weights, u=0, v=0):
    return (tuple(p), color, weights, (u,v))

def stripes(z, angle, face=False):
    band = cos(z*(55 if face else 31)+angle*.35+sin(angle*2.2)*1.5)
    return max(0,band)**4

def body_paint(z, a):
    color = blend(ginger, rgb('a9623c'), max(0,cos(a))*.52)
    color = blend(color, pale,max(0,-cos(a))**2*.76)
    return blend(color,copper,stripes(z,a)*(.34+.23*max(0,cos(a))))

def torso(sections, weight, paint, count=38, sides=28, head=False):
    rows=[]
    for v in steps(count):
        z=sections[0][0]+v*(sections[-1][0]-sections[0][0])
        x,y,center=profile(sections,z)
        row=[]
        for u in steps(sides+1):
            a=u*2*pi
            xx, yy=sin(a)*x,center+cos(a)*y
            socket=exp(-((abs(xx)-.085)/.039)**2-((yy-.631)/.027)**2-((z-.574)/.040)**2) if head else 0
            row.append(point((xx*(1-.14*socket),yy,z-.015*socket),
                             blend(paint(z,a),rgb('a76e46'),.41*socket),weight(z),u,v))
        rows.append(row)
    fur.grid(rows, caps=True, flip=True)

torso([(-.60,.018,.030,.447),(-.53,.119,.119,.442),(-.43,.154,.162,.428),
       (-.28,.136,.136,.428),(-.10,.122,.119,.429),(.08,.139,.146,.437),
       (.23,.151,.162,.444),(.32,.124,.146,.465),(.47,.064,.079,.556),(.52,.028,.044,.577)],
      lambda z: skin('Pelvis','Spine',(z+.43)/.26) if z<-.17 else
      skin('Spine','Chest',(z+.17)/.40) if z<.30 else skin('Chest','Neck',(z-.30)/.18),body_paint)

torso([(.362,.039,.070,.613),(.429,.113,.101,.618),(.503,.132,.108,.612),
       (.561,.115,.086,.603),(.610,.090,.066,.580),(.655,.062,.048,.567),
       (.684,.029,.027,.576),(.689,.004,.008,.582)],lambda _:solid('Head'),
      lambda z,a: blend(blend(ginger,cream,max(0,-cos(a))**1.7*.82),copper,
                        stripes(z,a,True)*(.26+.32*max(0,cos(a)))),32,30,head=True)

def oval(mesh, center, scales, color, name, rings=11, sides=16):
    x,y,z=center
    rx,ry,rz=scales
    rows=[]
    for v in steps(rings):
        theta = pi*(.00001+.99998*v)
        rows.append([point((x+rx*cos(a)*sin(theta),y+ry*cos(theta),z+rz*sin(a)*sin(theta)),
                           color(u,v) if callable(color) else color,solid(name),u,v)
                     for u in steps(sides+1) for a in [u*2*pi]])
    mesh.grid(rows,caps=True)

for side, tag in ((-1,'L'),(1,'R')):
    oval(fur,(side*.037,.555,.648),(.041,.027,.032),
         lambda u,v:blend(rgb('eac494'),ginger,.34+.22*cos(v*pi)), 'Head')
    oval(eyes,(side*.086,.632,.580),(.033,.023,.032),
         lambda u,v:blend(rgb('b3ad68'),rgb('787c44'),.31*sin(v*16+u*28)**2),
         'Eye'+tag,12,24)
    oval(eyes,(side*.083,.631,.610),(.0065,.019,.0055),rgb('29241b'),'Eye'+tag,9,12)
    oval(eyes,(side*.089,.639,.614),(.0045,.004,.003),rgb('dcded0'),'Eye'+tag,6,10)
    rings=[]
    ear_shape=[(.661,.042,.021,.085,.440),(.695,.054,.028,.091,.445),
               (.732,.046,.022,.099,.445),(.772,.033,.017,.113,.443),
               (.807,.020,.011,.125,.433),(.830,.007,.006,.130,.426),
               (.835,.001,.001,.130,.425)]
    for y,rx,rz,x,z in ear_shape:
        rings.append([point((side*x+sin(a)*rx,y,z+cos(a)*rz),
                            blend(ginger,rgb('b98272'),max(0,cos(a))**4*.79),
                            skin('Head','Ear'+tag,(y-.65)/.062))
                      for u in steps(17) for a in [u*2*pi]])
    fur.grid(rings,caps=True)
    for j in range(3):
        spread=.108+j*.018
        fur.cord([((side*.057,.561-j*.008,.671),.0015),
                  ((side*spread,.575-j*.019,.693),.0011),
                  ((side*(spread+.037),.579-j*.027,.685),.0006)],
                 rgb('dfc7a5'),solid('Head'),sides=3)

oval(fur,(0,.534,.631),(.051,.023,.060),rgb('d6b285'),'Jaw')
nose=[(-.028,.584,.678),(.028,.584,.678),(.016,.570,.688),(0,.563,.687),(-.016,.570,.688)]
rows=[[point((x,y,z-.008),rgb('865747'),solid('Head')) for x,y,z in nose],
      [point((x*.87,(y-.576)*.80+.576,z),rgb('b27a68'),solid('Head')) for x,y,z in nose]]
fur.grid(rows,closed=True,caps=True)

for side,tag in ((-1,'L'),(1,'R')):
    for fore in (True,False):
        name=('Fore' if fore else 'Hind')+tag
        z=.25 if fore else -.388
        points=[(.025,.032,.060,.033),(.072,.039,.052,.019),(.111,.027,.030,(-.003 if fore else -.045)),
                (.20,.029,.033,(-.023 if fore else .030)),(.266,.037,.041,(-.028 if fore else .09)),
                (.328,.044,.060,(.000 if fore else .063)),(.405,.052,.073,(0 if fore else .028)),
                (.495,.045,.057,0),(.519,.027,.044,0)]
        start=fur.lathe(points,(side*(.105 if fore else .115),0,z),
                   lambda t,a:blend(blend(ginger,pale,(1-t)*.51),copper,max(0,cos(t*31+a*.70))**5*.52),
                   lambda t: skin(name+'Paw',name+'Knee',(t-.07)/.21) if t<.45 else
                   skin(name+'Knee',name,(t-.46)/.26),rings=21,sides=14,
                   warp=lambda x,y,z,a,t:(x-side*.066*max(0,(t-.70)/.30)**1.5,y,z))
        for row in range(21):
            for column in range(14):
                fur.uvs[start+row*14+column]=(column/14,row/20)

rows=[]
for i in range((len(tail)-1)*5+1):
    j=min(len(tail)-2,i//5)
    u=(i-j*5)/5
    x,y,z,r=(a+(b-a)*u for a,b in zip(tail[j],tail[j+1]))
    shade=blend(body_paint(-.56,1),rgb('77432b'),max(0,cos(i*.86))**3*.82*min(1,i/6))
    rows.append([point((x+sin(a)*r,y+cos(a)*r,z),shade,skin(f'Tail{j}',f'Tail{j+1}',u),v,i/25)
                 for v in steps(13) for a in [v*2*pi]])
fur.grid(rows,caps=True)

for mesh in (fur,eyes):
    obj=mesh.build(rig)
    # Keep a longitudinal projection available for future painted materials.
    uv=obj.data.uv_layers.new(name='Coat UV')
    for loop in obj.data.loops:
        uv.data[loop.index].uv=mesh.uvs[loop.vertex_index]
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')

bpy.context.view_layer.objects.active=rig
for obj in bpy.context.selected_objects:
    obj.select_set(False)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            view=area.spaces.active
            view.region_3d.view_location=xyz((0,.42,-.20))
            view.region_3d.view_rotation=Euler((1.22,0,.83),'XYZ').to_quaternion()
            view.region_3d.view_distance=2.65
            view.overlay.show_overlays=False
            view.shading.color_type='VERTEX'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(art/'pets/simba.blend'),compress=True)
export(art.parent/'src/assets/pets/simba.glb',animate=False)
