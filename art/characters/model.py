"""Original resident models. Skeleton names and axes are the gameplay contract."""

from math import cos, pi, sin

import bpy
from mathutils import Vector

from mesh import Mesh, bell, blend, ramp, rgb, skin, solid, steps, xyz
from portrait import Portrait


class Resident:
    def __init__(self, name):
        self.name = name
        self.woman = name == 'alina'
        self.hip = .851 if self.woman else .905
        self.shoulder = 1.329 if self.woman else 1.390
        self.neck = 1.445 if self.woman else 1.509
        self.ankle = .084
        self.leg = .388 if self.woman else .411
        self.arm_x = .193 if self.woman else .220
        self.arm = .271 if self.woman else .296
        self.forearm = .284 if self.woman else .304
        self.portrait = Portrait(self.woman,1.724 if self.woman else 1.778)

    def rig(self):
        data = bpy.data.armatures.new('Resident skeleton')
        rig = bpy.data.objects.new('Resident',data)
        bpy.context.collection.objects.link(rig)
        bpy.context.view_layer.objects.active = rig
        rig.select_set(True)
        rig.show_in_front = True
        bpy.ops.object.mode_set(mode='EDIT')

        def bone(name, position, parent=None):
            b = data.edit_bones.new(name)
            b.head = xyz(position)
            b.tail = b.head+Vector((0,0,.08))
            if parent:
                b.parent = data.edit_bones[parent]

        bone('Pelvis',(0,0,0))
        bone('Chest',(0,0,0),'Pelvis')
        h = self.portrait.height
        bone('Head',(0,h-.016,-.008),'Chest')
        bone('Hair',(0,h-.016,-.008),'Head')
        for s,suffix in ((-1,'L'),(1,'R')):
            x = s*self.arm_x
            bone('Eye'+suffix,(s*self.portrait.eye_x,h,.106),'Head')
            bone('Arm'+suffix,(x,self.shoulder,0),'Chest')
            bone('Elbow'+suffix,(x,self.shoulder-self.arm,0),'Arm'+suffix)
            bone('Wrist'+suffix,(x,self.shoulder-self.arm-self.forearm,0),'Elbow'+suffix)
            bone('Thigh'+suffix,(s*.111,self.hip,0),'Pelvis')
            bone('Knee'+suffix,(s*.111,self.hip-self.leg,0),'Thigh'+suffix)
            bone('Ankle'+suffix,(s*.111,self.ankle,0),'Knee'+suffix)
        bpy.ops.object.mode_set(mode='OBJECT')
        rig['character'] = self.name
        rig['waistY'] = self.hip-.061
        return rig

    def figure(self, clothing, body):
        w = self.woman
        complexion = self.portrait.base
        top = rgb('729cb7' if w else 'e8e4d8')
        cuff = rgb('5d859f' if w else 'cccbc3')
        pants = rgb('414655' if w else '475968')
        seams = rgb('727888' if w else '778890')
        sole = rgb('d6c7b9')
        upper = rgb('b2ada9' if w else '666660')
        h,s,n = self.hip,self.shoulder,self.neck
        taper = .139 if w else .167
        chest = .173 if w else .203
        torso = [(h-.043,.189 if w else .194,.116,-.006),(h+.043,.169 if w else .185,.112,-.009),
                 (h+.157,taper,.099,-.007),(s-.135,chest,.119 if w else .127,.002),
                 (s-.045,chest+.010,.108,-.007),(s+.012,.169 if w else .192,.087,-.011),
                 (s+.064,.105,.069,-.012),(n,.074,.065,-.014)]
        def fabric(t,a):
            ribs = (.5+.5*cos(a*(20 if w else 9)+cos(t*11)*.6))**2
            hem = 1-ramp(.03,.125,t)
            collar = ramp(.91,.99,t)
            return blend(top,cuff,.16*ribs*(.82 if w else .34)+.58*max(hem,collar)+.10*max(0,-cos(a)))
        def folds(x,y,z,a,t):
            wrinkle = (.0048*bell((t-.30)/.17)+.0032*bell((t-.76)/.13))*sin(a*3+t*22)
            return x+sin(a)*wrinkle,y,z+cos(a)*wrinkle
        clothing.lathe(torso,(0,0,0),fabric,lambda _t:solid('Chest'),rings=18,sides=25,warp=folds)
        edge = [((.075*sin(a),n-.008-.005*cos(a),.068*cos(a)-.014),.005) for a in [2*pi*t for t in steps(23)]]
        clothing.cord(edge,blend(top,cuff,.61),solid('Chest'),sides=5,thickness=.62)
        neck = [(n-.053,.069,.062,-.013),(n+.037,.059,.057,-.016),
                 (n+.103,.065,.058,.002),(n+.172,.072,.063,.028)]
        body.lathe(neck,(0,0,0),lambda t,a:blend(complexion,rgb('ae796a'),.21*bell((t-.38)/.46)),
                   lambda t:skin('Chest','Head',(t-.34)/.54),rings=9,sides=15)
        seat = [(h-.113,.046,.050,-.017),(h-.092,.133,.082,-.014),
                (h-.047,.173,.098,-.010),(h-.009,.179,.101,-.008),(h+.034,.152,.092,-.008)]
        clothing.lathe(seat,(0,0,0),lambda t,a:blend(pants,seams,.10*max(0,cos(a))),
                       lambda _:solid('Pelvis'),rings=7,sides=20)

        for side,suffix in ((-1,'L'),(1,'R')):
            a,f = self.arm,self.forearm
            arm = 'Arm'+suffix
            elbow,wrist = 'Elbow'+suffix,'Wrist'+suffix
            x = side*self.arm_x
            def arm_bind(t):
                y = (t-1)*(a+f)
                return skin(elbow,arm,(y+a+.090)/.171) if y < -.086 else skin(arm,'Chest',(y+.086)/.167)

            def sheen(t,angle):
                cloth_shadow = .16*max(0,-cos(angle))
                ribbing = .10*(.5+.5*cos(angle*12-t*4)) if w else .021
                return blend(top,cuff,cloth_shadow+ribbing+.44*(1-ramp(.03,.12,t)))

            arm_shape = [(-a-f+.018,.036,.034,-.002),(-a-f+.053,.042,.041,-.004),
                         (-a-.100,.058,.046,-.012),(-a,.058,.050,.000),(-.118,.063,.059,.001),
                         (-.052,.075,.066,-.009),(.005,.072,.067,-.009),(.056,.043,.048,-.010),(.074,.023,.026,-.011)]
            def sleeve(xx,y,z,angle,t):
                wrinkle = .004*cos(angle*3+y*35)*bell((y+a)/.13)
                shoulder = ramp(-.048,.058,y)
                return (xx+sin(angle)*wrinkle-side*.047*shoulder,
                        y-.027*shoulder-.012*shoulder*max(0,side*sin(angle)),z+cos(angle)*wrinkle)
            if w:
                clothing.lathe(arm_shape,(x,s,0),sheen,arm_bind,rings=14,sides=17,warp=sleeve)
            else:
                # Turn the T-shirt sleeve into a rounded folded edge above the elbow.
                cut = [(-.184,.063,.060,-.001),(-.169,.068,.063,-.002),
                       (-.105,.073,.065,-.003),(-.039,.074,.069,-.008),
                       (.016,.064,.062,-.012),(.057,.044,.046,-.010),(.075,.022,.025,-.010)]
                clothing.lathe(cut,(x,s,0),sheen,lambda t:skin(arm,'Chest',(t-.47)/.36),
                               rings=9,sides=16,warp=sleeve)
                bare = [(-a-f+.006,.026,.025,0),(-a-f+.063,.032,.032,-.003),
                        (-a-.095,.043,.043,-.009),(-a,.047,.043,-.002),
                        (-.185,.052,.048,-.003),(-.132,.051,.050,-.007)]
                body.lathe(bare,(x,s,0),lambda t,ang:blend(complexion,rgb('a37366'),.12*max(0,-cos(ang))),
                           lambda t:skin(elbow,arm,(t-.50)/.32),rings=13,sides=14)
            wrist_y = s-a-f
            self.hand(body,x,wrist_y,side,wrist)
            self.trousers(clothing,body,pants,seams,sole,upper,side,suffix)

    def hand(self, body,x,y,side,wrist):
        shade = lambda t,a: blend(self.portrait.base,rgb('b48674'),.29*(1-t)*max(0,cos(a)))
        palm = [(-.077,.022,.012,.013),(-.059,.032,.019,.009),(-.036,.031,.019,.004),
                (-.010,.026,.022,-.001),(.031,.026,.024,0)]
        body.lathe(palm,(x,y,0),shade,lambda _:solid(wrist),rings=7,sides=12)
        for i in range(4):
            px = x+side*(i-1.42)*.014
            end = -.101+abs(i-1.39)*.005
            finger = [(end,.0045,.005,.018),(end+.008,.0071,.0074,.016),
                      (end+.027,.0079,.009,.009),(end+.041,.0066,.009,.006)]
            body.lathe(finger,(px,y,0),shade,lambda _:solid(wrist),rings=4,sides=7)
        thumb = [((x-side*.018,y-.022,.012),.012),((x-side*.029,y-.035,.016),.010),
                 ((x-side*.035,y-.048,.020),.008),((x-side*.034,y-.057,.021),.005)]
        body.cord(thumb,self.portrait.base,solid(wrist),sides=7)

    def trousers(self, clothing, trim, pants, seam, sole, upper, side, suffix):
        h,k = self.hip,self.leg
        x = side*.111
        thigh,knee,ankle = 'Thigh'+suffix,'Knee'+suffix,'Ankle'+suffix
        shape = [(.060,.050,.067,-.015),(.116,.059,.067,-.010),(.183,.064,.069,-.011),
                 (h-k-.110,.068,.073,-.014),(h-k,.074,.077,.000),
                 (h-.247,.083,.085,-.017),(h-.105,.091,.092,-.013),
                 (h+.012,.094,.099,-.010),(h+.048,.061,.078,-.018)]
        def denim(t,a):
            crease = bell(sin(a)*11)*max(0,cos(a))
            weld = bell((abs(sin(a))-.996)/.025)
            return blend(pants,seam,.12*max(0,cos(a))+.23*crease+.06*weld)
        def bind(t):
            y = shape[0][0]+(shape[-1][0]-shape[0][0])*t
            return skin(knee,thigh,(y-h+k+.104)/.189) if y < h-.133 else skin(thigh,'Pelvis',(y-h+.115)/.156)
        def fall(xx,y,z,a,t):
            shift = -side*.026*ramp(h-.125,h+.050,y)
            hem = .004*cos(a*5+y*64)*bell((y-.105)/.06)
            return xx+shift+sin(a)*hem,y,z+cos(a)*hem
        clothing.lathe(shape,(x,0,0),denim,bind,rings=15,sides=18,warp=fall)
        shoe = [(.006,.063,.129,.040),(.016,.070,.143,.044),(.038,.071,.142,.042),
                (.057,.070,.131,.041),(.084,.065,.114,.030),(.119,.061,.073,.008),
                (.139,.053,.062,-.005)]
        trim.lathe(shoe,(x,0,0),
                   lambda t,a:blend(upper,sole,1-ramp(.17,.33,t)),
                   lambda _:solid(ankle),rings=9,sides=16,
                   warp=lambda xx,y,z,a,t:(xx*(.86+.14*cos(a)),y,z))
        for z,y in [(.105,.106),(.126,.092),(.145,.083)]:
            laces = [((x-.032,y-.004,z-.003),.0028),((x,y,z),.0033),((x+.032,y-.004,z-.003),.0028)]
            trim.cord(laces,sole,solid(ankle),sides=5,thickness=.71)

    def build(self):
        rig = self.rig()
        skin_mesh = Mesh('Skin and accessories','Skin and trim',.72)
        eyes = Mesh('Eyes','Eyes',.31)
        clothing = Mesh('Tailored clothing','Cloth pigment',.85)
        face = self.portrait.head(skin_mesh,eyes)
        hair = self.portrait.hair()
        self.figure(clothing,skin_mesh)
        for mesh in (face,skin_mesh,eyes,hair,clothing):
            mesh.build(rig)
        return rig
