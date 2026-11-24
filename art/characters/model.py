"""Original resident models. Skeleton names and axes are the gameplay contract."""

from math import cos, pi, sin

import bpy
from mathutils import Vector

from mesh import Mesh, bell, blend, profile, ramp, rgb, skin, solid, steps, xyz
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

    def figure(self, clothing, body, lower, footwear, alternative=False):
        w = self.woman
        complexion = self.portrait.base
        top = rgb('729cb7' if w else 'e8e4d8')
        cuff = rgb('5d859f' if w else 'cccbc3')
        if alternative:
            top,cuff=rgb('dbd7c9'),rgb('bdb7a7')
        pants = rgb('414655' if w else '475968')
        seams = rgb('727888' if w else '778890')
        sole = rgb('d6c7b9')
        upper = rgb('b2ada9' if w else '666660')
        h,s,n = self.hip,self.shoulder,self.neck
        taper = .143 if w else .166
        chest = .173 if w else .203
        torso = [(h+.010,.202 if w else .210,.126,-.009),(h+.057,.177 if w else .190,.115,-.009),
                 (h+.157,taper,.099,-.007),(s-.135,chest,.119 if w else .127,.002),
                 (s-.045,chest+.010,.108,-.007),(s+.012,.169 if w else .192,.087,-.011),
                 (s+.064,.105,.069,-.012),(n,.074,.065,-.014)]
        def fabric(t,a):
            ribs = (.5+.5*cos(a*(20 if w and not alternative else 9)+cos(t*11)*.6))**2
            hem = 1-ramp(.03,.125,t)
            collar = ramp(.91,.99,t)
            return blend(top,cuff,.16*ribs*(.82 if w and not alternative else .34)+.58*max(hem,collar)+.10*max(0,-cos(a)))
        def folds(x,y,z,a,t):
            wrinkle = (.0072*bell((t-.30)/.16)+.0046*bell((t-.76)/.13))*sin(a*3+t*22)+.0025*sin(a*7-t*14)*bell((t-.64)/.28)
            return x+sin(a)*wrinkle,y,z+cos(a)*wrinkle
        clothing.lathe(torso,(0,0,0),fabric,lambda t:skin('Pelvis','Chest',ramp(.015,.32,t)),
                       rings=22,sides=25,warp=folds)
        edge = [((.075*sin(a),n-.008-.005*cos(a),.068*cos(a)-.014),.005) for a in [2*pi*t for t in steps(23)]]
        clothing.cord(edge,blend(top,cuff,.61),solid('Chest'),sides=5,thickness=.62)
        collar = [((.081*sin(a),n-.019-.007*cos(a),.073*cos(a)-.012),.0036)
                  for a in [2*pi*t for t in steps(26)]]
        clothing.cord(collar,blend(top,cuff,.46),solid('Chest'),sides=6)
        if w and not alternative:
            for side in (-1,1):
                path = [((side*x,y,z),r) for x,y,z,r in [(.074,n-.019,.069,.007),
                    (.101,s-.048,.102,.008),(.067,s-.144,.116,.008),(.024,h+.192,.106,.006)]]
                clothing.cord(path,blend(top,cuff,.55),solid('Chest'),sides=6,thickness=.64)
        elif not w:
            for side in (-1,1):
                path = [((side*x,y,z),r) for x,y,z,r in [(.090,n-.033,.062,.003),
                    (.129,s-.098,.097,.0023),(.169,s-.113,.082,.0022)]]
                clothing.cord(path,cuff,solid('Chest'),sides=5)
        self.sleeves(clothing, top, cuff, long=w and not alternative)
        if alternative:
            return
        neck = [(n-.053,.069,.062,-.013),(n+.037,.059,.057,-.016),
                 (n+.103,.065,.058,.002),(n+.172,.072,.063,.028)]
        body.lathe(neck,(0,0,0),lambda t,a:blend(complexion,rgb('ae796a'),.21*bell((t-.38)/.46)),
                   lambda t:skin('Chest','Head',(t-.34)/.54),rings=9,sides=15)
        seat = [(h-.113,.046,.050,-.017),(h-.092,.133,.082,-.014),
                (h-.047,.173,.098,-.010),(h-.009,.179,.101,-.008),(h+.034,.152,.092,-.008)]
        lower.lathe(seat,(0,0,0),lambda t,a:blend(pants,seams,.10*max(0,cos(a))),
                       lambda _:solid('Pelvis'),rings=7,sides=20)

        for side,suffix in ((-1,'L'),(1,'R')):
            self.hand(body,side*self.arm_x,s-self.arm-self.forearm,side,'Wrist'+suffix)
            self.trousers(lower,footwear,pants,seams,sole,upper,side,suffix)

    def arm_weights(self, y, suffix):
        if y < -.086:
            return skin('Elbow'+suffix,'Arm'+suffix,(y+self.arm+.082)/.166)
        return skin('Arm'+suffix,'Chest',(y+.086)/.167)

    def sleeves(self,clothing,top,cuff,long):
        w,s=self.woman,self.shoulder
        for side,suffix in ((-1,'L'),(1,'R')):
            a,f = self.arm,self.forearm
            x = side*self.arm_x
            def sheen(t,angle):
                cloth_shadow = .16*max(0,-cos(angle))
                ribbing = .10*(.5+.5*cos(angle*12-t*4)) if w else .021
                return blend(top,cuff,cloth_shadow+ribbing+.44*(1-ramp(.03,.12,t)))

            sections = [(-a-f+.020,.041,.041,-.002),(-a-f+.055,.046,.043,-.004),
                        (-a-.100,.058,.046,-.012),(-a,.058,.050,.000),(-.118,.063,.059,.001),
                        (-.052,.075,.066,-.009),(.005,.072,.067,-.009),(.056,.043,.048,-.010),(.074,.023,.026,-.011)] if long else [
                        (-.173,.061,.058,-.002),(-.155,.068,.063,-.002),(-.100,.072,.065,-.003),
                        (-.039,.074,.069,-.008),(.016,.064,.062,-.012),(.057,.044,.046,-.010),(.075,.022,.025,-.010)]
            def sleeve(xx,y,z,angle,t):
                wrinkle = .004*cos(angle*3+y*35)*bell((y+a)/.13)
                shoulder = ramp(-.048,.058,y)
                return (xx+sin(angle)*wrinkle-side*.047*shoulder,
                        y-.027*shoulder-.012*shoulder*max(0,side*sin(angle)),z+cos(angle)*wrinkle)
            def bind(t):
                y = sections[0][0] + (sections[-1][0]-sections[0][0])*t
                return self.arm_weights(y, suffix)
            clothing.lathe(sections,(x,s,0),sheen,bind,rings=14 if long else 10,sides=17,warp=sleeve)
            if long:
                cuffs = [((x+.044*sin(angle),s-a-f+.038,.042*cos(angle)-.003),.0026)
                         for angle in [2*pi*t for t in steps(16)]]
                clothing.cord(cuffs,cuff,solid('Elbow'+suffix),sides=5)

    def forearms(self, mesh):
        a,f=self.arm,self.forearm
        for side,suffix in ((-1,'L'),(1,'R')):
            shape = [(-a-f+.010,.026,.024,0),(-a-f+.054,.030,.029,-.003),
                     (-a-.085,.039,.038,-.009),(-a,.043,.041,-.003),
                     (-.184,.049,.045,-.003),(-.126,.050,.047,-.006)]
            def bind(t):
                y=shape[0][0]+(shape[-1][0]-shape[0][0])*t
                return self.arm_weights(y,suffix)
            mesh.lathe(shape,(side*self.arm_x,self.shoulder,0),
                       lambda _t,ang:blend(self.portrait.base,rgb('a37366'),.12*max(0,-cos(ang))),
                       bind,rings=13,sides=14)

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

    def trousers(self, clothing, trim, pants, seam, sole, upper, side, suffix, covered_above=None):
        h,k = self.hip,self.leg
        x = side*.111
        thigh,knee,ankle = 'Thigh'+suffix,'Knee'+suffix,'Ankle'+suffix
        shape = [(.060,.050,.067,-.015),(.116,.059,.067,-.010),(.183,.064,.069,-.011),
                 (h-k-.110,.068,.073,-.014),(h-k,.074,.077,.000),
                 (h-.247,.083,.085,-.017),(h-.105,.091,.092,-.013),
                 (h+.012,.094,.099,-.010),(h+.048,.061,.078,-.018)]
        if covered_above is not None:
            fit=profile(shape,covered_above)
            shape=[ring for ring in shape if ring[0]<covered_above]+[(covered_above,*fit)]
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
        clothing = Mesh('Signature upper','Cloth pigment',.84)
        lower = Mesh('Signature trousers','Denim pigment',.89)
        footwear = Mesh('Signature footwear','Footwear',.58)
        face = self.portrait.head(skin_mesh,eyes)
        hair = self.portrait.hair()
        self.figure(clothing,skin_mesh,lower,footwear)
        for mesh in (face,skin_mesh,eyes,hair):
            mesh.build(rig)
        forearms=Mesh('Forearms','Skin and trim',.72)
        self.forearms(forearms)
        forearms.build(rig)['bodyRegion']='forearms'
        for mesh,slot in ((clothing,'upper'),(lower,'lower'),(footwear,'footwear')):
            self.garment(rig,mesh,slot,'signature')
        if self.woman:
            other=Mesh('Plain T-shirt','Cloth pigment',.91)
            self.figure(other,skin_mesh,lower,footwear,alternative=True)
            self.garment(rig,other,'upper','tee')
        from wardrobe import add_wardrobe
        add_wardrobe(self,rig)
        return rig

    def garment(self,rig,mesh,slot,look):
        obj=mesh.build(rig)
        obj['garmentSlot']=slot
        obj['garmentId']=self.name+'-'+look+'-'+slot
        obj['garmentFit']=self.name+'-021'
        obj['garmentDefault']=look=='signature'
