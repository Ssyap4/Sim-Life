"""Editable individual neighbors for the district, with the shared motion rig."""
import argparse
from dataclasses import dataclass
from math import cos, pi, sin
from pathlib import Path
import sys

import bpy
from mathutils import Quaternion

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from export import export
from mesh import Mesh, bell, blend, linear, profile, ramp, rgb, skin, solid, steps
from model import Resident
from portrait import HIGH, HEAD, Portrait


@dataclass(frozen=True)
class Design:
    name: str
    woman: bool
    height: float
    shoulders: float
    form: float
    jaw: float
    cheek: float
    nose: float
    mouth: float
    eyes: float
    complexion: str
    plumage: str
    hair: str
    outfit: str
    top: str
    bottom: str
    accent: str
    glasses: bool = False
    beard: float = 0


# Order is the stable resident index used by src/shared/neighbors.ts.
DESIGNS = (
    Design('Марина', True,.985,1.03,1.11,1.14,1.08,.84,1.09,1.00,'e3b598','68392d','bob','trench','af7865','414f65','dec3a0'),
    Design('Денис', False,1.045,.99,.91,.97,1.04,1.03,.91,1.08,'d9a98c','382923','swept','hoodie','597c6e','485160','a9b993',False,.33),
    Design('Виктория', True,1.032,.88,.87,.86,1.02,1.13,.89,.92,'f2ccb0','b18c5d','pony','pea coat','657f95','343950','ccb98d',True),
    Design('Артём', False,1.085,1.12,1.16,1.20,.90,.88,1.12,.91,'d0a185','3f322b','buzz','vest','947857','4e5a68','bbb086',False,.15),
    Design('Екатерина', True,1.038,1.00,.99,.87,1.14,1.18,1.20,1.12,'e6bd9e','88674b','waves','swing dress','927186','575851','d0a77b'),
    Design('Илья', False,1.035,.94,.90,1.11,1.01,1.25,1.00,1.00,'e1b596','60482f','curls','overshirt','7896a2','484e4d','c0c5af'),
    Design('Ольга', True,.962,1.00,1.20,1.10,1.03,1.19,.97,1.14,'d6a182','483228','bun','rollneck','9b9d72','60524c','c7a18d',True),
    Design('Максим', False,1.12,1.17,1.09,1.17,1.07,1.08,1.14,1.01,'ecc29d','423229','sidepart','bomber','a67854','434d59','7b8c96',False,.57),
    Design('Полина', True,1.016,.92,.9,.94,1.09,.83,1.10,1.04,'eec6ad','775235','braid','dungarees','9c947c','5b8177','d7b883'),
    Design('Егор', False,1.012,.99,.98,.91,1.15,.91,1.09,1.10,'c89573','362d25','cap','anorak','75859a','595650','d5ab77'),
    Design('София', True,.974,.93,.88,.95,.94,.95,.95,.94,'e5bdab','a57e56','straight','long coat','b77579','415867','dcc29d'),
    Design('Кирилл', False,1.078,1.09,1.03,1.13,.97,1.15,1.02,.97,'d4a586','514232','undercut','workwear','719081','4d545a','bfaa85',False,.15),
    Design('Наталья', True,1.005,1.11,1.14,1.04,1.14,1.04,1.18,1.08,'e7b897','68472f','ringlets','layered dress','9e809a','455462','bdd2b5',True),
    Design('Роман', False,1.062,1.04,1.06,1.10,.96,1.29,.93,1.12,'d7a98f','66584b','grey','field jacket','827459','52546a','aab8b1',True,.85),
)


class IndividualPortrait(Portrait):
    def __init__(self, design, height, index):
        super().__init__(design.woman,height)
        self.design,self.index=design,index
        self.base=rgb(design.complexion)
        self.brow=blend(rgb(design.plumage),self.base,.15)
        self.iris=rgb(('618778','8d7049','7296a1','527467','776047','54717d','8a7b59')[index%7])
        self.mouth_w*=design.mouth
        self.mouth_y+=.008*sin(index*2.40)
        self.eye_x*=design.eyes
        self.widths=[(y,x*(1+(design.jaw-1)*bell((y+.133)/.080)+(design.cheek-1)*bell((y+.036)/.080)),
                     z*(.90+.16*design.nose),z0+.009*sin(index*2.4)*bell((y+.169)/.06))
                    for y,x,z,z0 in self.widths]

    def face_depth(self,x,y,cosine):
        n=self.design.nose-1
        frontal=max(0,cosine)
        nose=n*.18*bell(x/(.022+n*.012))*bell((y+.052)/.026)
        cheek=(self.design.cheek-1)*.060*bell((abs(x)-.108)/.040)*bell((y+.032)/.049)
        chin=(self.design.jaw-1)*.037*bell(x/.064)*bell((y+.158)/.043)
        return super().face_depth(x,y,cosine)+frontal*(nose+cheek+chin)

    def paint(self):
        # The portrait uses painted vertex bands, so a visiting NPC costs no skin atlas.
        return None

    def head(self, skin_mesh, eye_mesh):
        face=super().head(skin_mesh,eye_mesh)
        for i,((x,y,z),uv) in enumerate(zip(face.points,face.uvs)):
            y-=self.height
            front=ramp(.02,.105,z)
            side=abs(x)
            blush=bell((side-.103)/.048)*bell((y+.050)/.040)*front
            color=blend(self.base,rgb('b97064'),blush*(.37 if self.woman else .22))
            color=blend(color,rgb('f1c8a7'),.25*bell((y-.072)/.096)*front)
            y0,full,upper,lower=self.lip_shape(x)
            if side<self.mouth_w and z>.108 and uv[1]>.27:
                edge=max(.002,float(full)*(upper if y>y0 else lower))
                color=blend(color,rgb('9b5655' if self.woman else 'a16859'), .76*bell((y-float(y0))/edge))
            eyelid=bell((side-self.eye_x)/.039)*bell((y-.008)/.015)
            color=blend(color,rgb('ac746e'),.34*eyelid*front)
            chin=self.design.beard*bell((y+.149)/.074)*ramp(.02,.108,z)
            color=blend(color,blend(self.brow,self.base,.40),chin*.68)
            face.colors[i]=(*linear(color),1)
        if self.design.glasses:
            rim=blend(self.brow,rgb('75665b'),.39)
            for side in (-1,1):
                x=side*self.eye_x
                cut=[((x+.044*sin(a),self.height-.001+.025*cos(a),self.depth(x,0)+.048-.013*side*sin(a)),.0038)
                     for a in [2*pi*t for t in steps(30)]]
                skin_mesh.cord(cut,rim,HEAD,sides=5)
                skin_mesh.cord([((side*.10,self.height+.007,.131),.004),((side*.141,self.height+.006,.068),.0032),
                     ((side*.142,self.height+.004,-.008),.0034)],rim,HEAD,sides=5)
            skin_mesh.cord([((-.020,self.height+.008,.146),.0036),((0,self.height+.013,.159),.003),
                            ((.020,self.height+.008,.146),.0036)],rim,HEAD,sides=5)
        return face

    def hair(self):
        mode=self.design.hair
        base=rgb(self.design.plumage)
        dark=blend(base,rgb('252222'),.31)
        light=blend(base,rgb('d8bb99'),.30)
        mesh=Mesh('Styled hair','Neighbor hair',.69)
        rings=[]
        styles=('bob','waves','straight','braid','ringlets')
        height={'buzz':.009,'grey':.017,'undercut':.032,'swept':.053,'curls':.043,'sidepart':.053}.get(mode,.026)
        part={'bob':-.44,'pony':.22,'waves':.05,'sidepart':.69,'undercut':-.73}.get(mode,.19)
        for t in steps(16):
            ring=[]
            for u in steps(44):
                a=(u-.5)*2*pi
                back=max(0,-cos(a));front=max(0,cos(a))
                edge=.032+.104*front**.75-.090*back+.024*front*sin(a+part)
                if mode in styles:
                    edge-=.078*back+.045*max(0,abs(sin(a))-.28)
                y=edge+(HIGH-edge)*t
                rx,rz,z0=profile(self.widths,y)
                ridge=(.5+.5*cos(a*14+t*13+2.1*sin(a+part-t*2)))**3
                bulk=.004+(.011+.006*ridge)*sin(t*pi)**.54
                quiff=height*sin(t*pi)*(front*.62+.38)*(1+(.33*sin(a+part)))
                ring.append(((sin(a)*(rx+bulk)+.017*sin(part)*front*sin(pi*t),self.height+y+quiff+.017*t,
                            z0+cos(a)*(rz+bulk)+quiff*.31),blend(dark,light,.27+.43*ridge+.12*t),HEAD,(u,t)))
            rings.append(ring)
        mesh.grid(rings)
        mesh.faces.append(tuple(range(len(mesh.points)-len(rings[-1]),len(mesh.points))))

        def lock(a, length, radius, wave, offset=0):
            pin=(sin(a)*.139,self.height+.078,cos(a)*.134-.018)
            path=[]
            for t in steps(9):
                px=pin[0]+sin(a)*(.023*sin(t*pi)+offset*t)+wave*sin(12*t+a)*t
                py=pin[1]-t*length
                pz=pin[2]+cos(a)*.04*sin(t*pi)+wave*cos(t*9+a)*t
                path.append(((px,py,pz),radius*(.50+.49*sin(pi*t)**.6)*(1-.54*t)+.002))
            mesh.cord(path,blend(base,light,.28+.14*sin(a*2)),skin('Hair','Head',.69),sides=7,thickness=.69)
        if mode in ('bob','waves','straight','ringlets'):
            length={'bob':.279,'waves':.503,'straight':.46,'ringlets':.332}[mode]
            wav={'bob':.007,'waves':.030,'straight':.008,'ringlets':.038}[mode]
            for n in range(23 if mode=='ringlets' else 17):
                a=.87+n*(2*pi-1.78)/(22 if mode=='ringlets' else 16)
                lock(a,length+.035*sin(n*2.36),.035 if mode=='bob' else .031,wav)
        if mode in ('pony','bun','braid'):
            if mode=='bun':
                for a in [n*2*pi/7 for n in range(7)]:
                    rings=[((.081*sin(a),self.height+.165+.045*cos(a),-.129),.027),
                           ((.049*sin(a+.75),self.height+.188+.041*cos(a+.75),-.186),.037),
                           ((0,self.height+.174,-.217),.022)]
                    mesh.cord(rings,blend(base,light,.29+.12*cos(a)),HEAD,sides=7)
            else:
                count=3 if mode=='braid' else 8
                for n in range(count):
                    phase=n*2*pi/count
                    path=[((.061+.032*sin(t*20+phase)*(1-.56*t),self.height+.060-t*(.52 if mode=='braid' else .375),
                            -.139-.06*sin(t*pi)+.026*cos(t*20+phase)),.030*(1-.68*t)+.008) for t in steps(21)]
                    mesh.cord(path,blend(base,light,.25+.28*(n%2)),skin('Hair','Head',.45),sides=7)
                lock(.96,.265,.022,.017);lock(-.88,.245,.022,.014)
        if mode=='curls':
            for i in range(18):
                a=i*2.4;t=(i+.5)/18
                path=[((.14*sin(a)*cos(t*pi/2)+.025*sin(k*2*pi),
                    self.height+.137+.123*t+.026*k,
                    -.02+.141*cos(a)*cos(t*pi/2)+.025*cos(k*2*pi)),.025+.007*sin(k*pi)) for k in steps(9)]
                mesh.cord(path,blend(base,light,.18+.30*(i%3)/2),HEAD,sides=7)
        if mode=='cap':
            crown=[(.073,.150,.162,-.018),(.088,.159,.171,-.018),(.164,.145,.162,-.028),
                   (.215,.117,.126,-.035),(.248,.030,.037,-.042)]
            color=rgb('465d71')
            mesh.lathe(crown,(0,self.height,0),lambda t,a:blend(color,rgb('849b9b'),.25*t),lambda _:HEAD,rings=13,sides=24)
            for i in range(7):
                theta=(i-3)*.20
                brim=[((sin(theta)*.132,self.height+.086,cos(theta)*.137),.0155),
                      ((sin(theta)*.150,self.height+.061,cos(theta)*.200),.0185),
                      ((sin(theta)*.148,self.height+.047,cos(theta)*.230),.013)]
                mesh.cord(brim,color,HEAD,sides=6,thickness=.61)
        return mesh


class Neighbor(Resident):
    def __init__(self, design,index):
        self.name=f'neighbor-{index+1:02d}'
        self.woman=design.woman
        self.design=design
        broad=design.shoulders
        h=design.height
        self.hip=(.86 if design.woman else .90)*h
        self.shoulder=(1.35 if design.woman else 1.43)*h
        self.neck=(1.47 if design.woman else 1.54)*h
        self.ankle=.079
        self.leg=(self.hip-.095)*.507
        self.arm_x=(.194 if design.woman else .211)*broad
        self.arm=(.280 if design.woman else .292)*h
        self.forearm=(.267 if design.woman else .294)*h
        self.portrait=IndividualPortrait(design,(1.727 if design.woman else 1.78)*h,index)

    def build(self):
        rig=self.rig()
        rig['neighborIndex']=self.portrait.index
        rig['name']=self.design.name
        trim=Mesh('Hands ears and details','Neighbor skin and trim',.73)
        eyes=Mesh('Eyes','Neighbor eyes',.33)
        clothes=Mesh('Cut and sewn silhouette','Neighbor cloth',.88)
        face=self.portrait.head(trim,eyes)
        hair=self.portrait.hair()
        self.sew(clothes,trim)
        # With vertex pigments a single skin shares the face, eye, hair and clothing joints.
        for mesh in (face,trim,eyes,hair,clothes):
            mesh.build(rig)
        return rig

    def sew(self,clothes,trim):
        d=self.design
        top,pants,detail=map(rgb,(d.top,d.bottom,d.accent))
        cloth=lambda t,a:blend(top,detail,.10*(.5+.5*cos(a*9+t*10))+.12*max(0,-cos(a)))
        h,s,n=self.hip,self.shoulder,self.neck
        w=d.form;shoulder=d.shoulders
        mode=d.outfit
        long=mode in ('trench','long coat','swing dress','layered dress','pea coat')
        dress=mode in ('swing dress','layered dress')
        hem=(h-.28 if mode=='long coat' else h-.23 if dress or mode=='trench' else h-.10 if long else h-.043)
        flare=(.280 if dress else .245 if long else .193)*w
        add=.014 if mode in ('vest','hoodie','bomber','pea coat') else 0
        waist=.145*w+add
        upper=.166*shoulder+add
        torso=[(hem,flare,.128,-.009),(hem+.054,flare*.96,.130,-.007),
               (h+.049,.178*w+add,.118,.001),(h+.213,waist,.101,.004),
               (s-.124,upper+.010,.128,.016),(s-.034,upper+.012,.107,.000),
               (s+.027,upper*.89,.087,-.009),(s+.091,.098,.070,-.008),(n,.076,.066,-.012)]
        if hem+.054>=h+.049:torso.pop(1)
        bind=lambda t: skin('Pelvis','Chest',t*2)
        def wrinkles(x,y,z,a,t):
            seam=sin(a*(8 if dress else 4)+t*14)*(.0113 if dress else .0058)
            k=seam*(.22+.78*bell((t-.21)/.30)+.22*bell((t-.81)/.21))
            return x+sin(a)*k,y,z+cos(a)*k
        clothes.lathe(torso,(0,0,0),cloth,bind,rings=20,sides=28,warp=wrinkles)
        trim.lathe([(n-.066,.075,.057,-.016),(n+.026,.065,.062,-.006),
            (n+.087,.072,.059,.006),(n+.151,.077,.067,.032)],(0,0,0),
            lambda t,a:blend(self.portrait.base,rgb('986858'),.19*max(0,-cos(a))),lambda t:skin('Chest','Head',t*.85),rings=8,sides=14)
        waistband=hem+.080 if long else hem+.046
        if dress or 'coat' in mode or mode in ('trench','bomber','dungarees'):
            hem_path=[((sin(a)*(.161*w if dress else flare*.93),h+.180 if dress else waistband,cos(a)*.120),.006)
                      for a in [t*2*pi for t in steps(27)]]
            clothes.cord(hem_path,blend(top,detail,.36),solid('Chest' if dress else 'Pelvis'),sides=5)
        if mode in ('hoodie','anorak'):
            hood=[(s-.09,.145,.096,-.074),(s-.025,.137,.119,-.092),(s+.089,.105,.124,-.103),(s+.127,.067,.079,-.121)]
            clothes.lathe(hood,(0,0,0),cloth,lambda _:solid('Chest'),rings=11,sides=18)
            for side in (-1,1):
                line=[((.039*side,n-.053,.070),.0033),((.055*side,s-.107,.120),.0032),
                      ((.038*side,s-.191,.126),.0024)]
                clothes.cord(line,detail,solid('Chest'),sides=5)
        elif mode=='rollneck':
            clothes.lathe([(n-.086,.087,.079,0),(n-.018,.082,.073,0),(n+.020,.077,.065,0)],(0,0,0),cloth,lambda _:solid('Chest'),rings=7,sides=21)
        elif mode in ('dungarees','workwear'):
            bib=[(h+.07,.158,.035,.109),(h+.20,.150,.029,.101),(s-.14,.106,.024,.116)]
            clothes.lathe(bib,(0,0,0),lambda t,a:blend(pants,detail,.08+.12*t),lambda _:solid('Chest'),rings=10,sides=20)
            for side in (-1,1):
                tape=[((side*.094,s-.14,.141),.020),((side*.135,s-.045,.103),.017),((side*.13,s+.018,.012),.016)]
                clothes.cord(tape,pants,solid('Chest'),sides=6,thickness=.34)
        else:
            for side in (-1,1):
                lapel=[((side*.07,n-.025,.062),.009),((side*.135,s-.073,.109),.021),
                       ((side*.067,s-.163,.136),.016),((side*.024,h+.17,.123),.006)]
                clothes.cord(lapel,blend(top,detail,.37),solid('Chest'),sides=6,thickness=.43)
            for k in range(4):
                button_y=h+.14+k*.068
                clothes.lathe([(-.008,.004,.004,0),(0,.010,.008,0),(.008,.004,.004,0)],
                    (.023,button_y,.129),lambda t,a:detail,lambda _:solid('Chest'),rings=4,sides=8)
        for direction,suffix in ((-1,'L'),(1,'R')):
            x=direction*self.arm_x;a,f=self.arm,self.forearm
            upper,elbow='Arm'+suffix,'Elbow'+suffix
            sleeve=[(-a-f+.022,.037,.035,0),(-a-f+.095,.046,.047,.004),
                    (-a+.001,.060,.054,.004),(-.130,.066*w,.065,.005),(-.044,.078*w,.072,-.007),
                    (.025,.071,.065,-.008),(.065,.033,.033,-.011)]
            def sleeve_bind(t):
                y=sleeve[0][0]+t*(sleeve[-1][0]-sleeve[0][0])
                return skin(elbow,upper,(y+a+.067)/.153) if y<-.071 else skin(upper,'Chest',(y+.071)/.17)
            def crease(x,y,z,a,t):
                q=(.005+(.005 if mode=='bomber' else 0))*bell((t-.58)/.32)*sin(a*4+t*18)
                return x+q*sin(a),y,z+q*cos(a)
            sleeve_color=blend(top,detail,.21) if mode in ('vest','dungarees') else top
            clothes.lathe(sleeve,(x,s,0),lambda t,a:blend(sleeve_color,detail,.15*(1-t)+.12*max(0,-cos(a))),
                sleeve_bind,rings=14,sides=15,warp=crease)
            self.hand(trim,x,s-a-f,direction,'Wrist'+suffix)
            self.trousers(clothes,clothes,pants,blend(pants,detail,.31),rgb('524c46' if d.woman else '5b554c'),
                rgb('8f7868' if d.woman else '5d625e'),direction,suffix)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--output-dir',type=Path,default=HERE.parent.parent/'src/assets/neighbors')
    parser.add_argument('--source',type=Path,default=HERE/'neighbors-021.blend')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene
    for index,design in enumerate(DESIGNS):
        model=Neighbor(design,index)
        rig=model.build()
        bpy.ops.object.select_all(action='DESELECT')
        rig.select_set(True)
        for part in rig.children:part.select_set(True)
        export(args.output_dir/(model.name+'.glb'),selection=True,animate=False)
        collection=bpy.data.collections.new(f'{index+1:02d} · {design.name}')
        scene.collection.children.link(collection)
        for obj in (rig,*rig.children):
            for c in list(obj.users_collection):c.objects.unlink(obj)
            collection.objects.link(obj)
        rig.name=f'{model.name} · {design.name}'
        rig.location.x=(index%7-3)*1.04
        rig.location.y=(-.78 if index<7 else .78)
    bpy.context.preferences.filepaths.save_version=0
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                view=area.spaces.active
                view.region_3d.view_location=(0,0,1.04)
                view.region_3d.view_distance=9
                view.region_3d.view_rotation=Quaternion((1,0,0),1.29)
                view.shading.type='MATERIAL'
    bpy.ops.wm.save_as_mainfile(filepath=str(args.source.resolve()),compress=True)


if __name__=='__main__':
    main()
