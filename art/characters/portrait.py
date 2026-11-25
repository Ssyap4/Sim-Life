"""Hand-shaped heads, painted skin, eye apertures and swept hair surfaces."""

from math import asin, cos, pi, sin, sqrt

import bpy
import numpy as np

from mesh import Mesh, bell, blend, profile, ramp, rgb, smooth, solid, skin, spline, steps

WHITE = (1,1,1)
HEAD = solid('Head')
LOW, HIGH = -.209, .213


class Portrait:
    def __init__(self, woman, height):
        self.woman = woman
        self.height = height
        self.base = rgb('edbda6' if woman else 'd8a98b')
        self.brow = rgb('695044' if woman else '4b332b')
        self.iris = rgb('6491ab' if woman else '746849')
        self.mouth_y = -.112 if woman else -.121
        self.mouth_w = .051 if woman else .050
        self.eye_x = .060 if woman else .059
        self.nose_projection = .77 if woman else .90
        self.nose_width = 1.02 if woman else 1.0
        self.face_relief = True
        self.widths = (
            [(LOW,.009,.010,.062),(-.192,.062,.063,.036),(-.163,.090,.091,.021),
             (-.128,.114,.114,.008),(-.077,.137,.138,-.004),(-.031,.144,.145,-.009),
             (.028,.145,.151,-.016),(.080,.140,.145,-.019),(.132,.127,.128,-.025),
             (.176,.098,.091,-.028),(.202,.050,.053,-.031),(HIGH,.003,.006,-.031)]
            if woman else
            [(LOW,.014,.014,.055),(-.190,.067,.065,.036),(-.161,.099,.091,.017),
             (-.120,.114,.115,.002),(-.073,.127,.128,-.007),(-.022,.139,.145,-.016),
             (.031,.142,.148,-.022),(.079,.139,.145,-.026),(.129,.124,.125,-.030),
             (.176,.095,.090,-.032),(.204,.042,.044,-.031),(HIGH,.002,.004,-.030)]
        )

    def lip_shape(self, x):
        a = np.clip(x/self.mouth_w,-1.,1.)
        full = np.maximum(0,1-a*a)**.68
        middle = self.mouth_y + .0038*a*a + .0014*a + .0016*np.exp(-(a/.19)**2)
        cupid = .0035*np.exp(-((np.abs(a)-.27)/.19)**2)
        upper = (.0108 if self.woman else .0072)+cupid
        lower = .0148 if self.woman else .0108
        return middle, full, upper, lower

    def face_depth(self, x, y, cosine):
        a = abs(x)
        w = self.woman
        tip_y = -.054 if w else -.063
        nose_x = x / self.nose_width
        nose_side = abs(nose_x)
        brow = bell((y-.035)/.022)*bell((a-.059)/.047)
        brow_shape = (.009 if w else .019)*brow
        socket = -.014*bell(y/.031)*bell((a-self.eye_x)/.042)
        cheek = (.018 if w else .023)*bell((a-.099)/.046)*bell((y+.035)/.045)
        jaw = (.003 if w else -.010)*bell((a-.100)/.038)*bell((y+.106)/.037)
        ridge = (.038 if w else .046)*bell((y+.028)/.052)*bell(nose_x/(.020 if w else .024))
        tip = (.031 if w else .041)*bell((y-tip_y)/(.019 if w else .016))*bell((nose_x+.0018)/.022)
        wing = .015*bell((y-tip_y+.006)/.013)*bell((nose_side-.018)/.010)
        nostril = -.0068*bell((nose_side-.016)/.0055)*bell((y-tip_y+.014)/.005)
        nose = self.nose_projection*(ridge+tip) + (.65+.35*self.nose_projection)*(wing+nostril)
        muzzle = .017*bell(x/.063)*bell((y-self.mouth_y)/.043)
        chin = .018*bell(x/(.050 if w else .059))*bell((y+.174)/.034)
        fold = -.006*bell((y-self.mouth_y+.028)/.009)*bell(x/.036)
        line, full, upper, lower = self.lip_shape(x)
        dy = y-line
        ph = dy/(max(.001,full)*(upper if dy >= 0 else lower))
        lip = full * (.0062*bell(ph*1.9-.65)+.0071*bell(ph*1.7+.63)-.0021*bell(ph*5))
        relief=0
        if self.face_relief:
            lid_slope=.0049*bell((y-.016)/.010)*bell((a-self.eye_x)/.035)
            cheek_line=.0042*bell((a-.099)/.027)*bell((y+.047+.25*(a-.10))/.025)
            lower_jaw=(.0045 if w else .0082)*bell((y+.124)/.023)*bell((a-.088)/.034)
            philtrum=-.0031*bell(x/.007)*bell((y+.091)/.012)
            relief=lid_slope+cheek_line+lower_jaw+philtrum
        return max(0,cosine)*(brow_shape+socket+cheek+jaw+nose+muzzle+chin+fold+lip+relief)

    def depth(self,x,y):
        rx,rz,z = profile(self.widths,y)
        angle = asin(max(-1,min(1,x/rx)))
        return z+rz*cos(angle)+self.face_depth(x,y,cos(angle))

    def point(self,x,y,z):
        return x,self.height+y,z

    def uv(self,a,y):
        return a/(2*pi)+.5, .27+.71*(y-LOW)/(HIGH-LOW)

    def paint(self):
        """Bake a 1024px atlas. The lower rows are reserved for the eyelid islands."""
        size = 1024
        axis = (np.arange(size)+.5)/size
        u,v = np.meshgrid(axis,axis)
        a = (u-.5)*2*pi
        y = LOW+(HIGH-LOW)*np.clip((v-.27)/.71,0,1)
        radii = np.array([profile(self.widths,h)[0] for h in y[:,0]])
        x = np.sin(a)*radii[:,None]
        side = np.abs(x)
        front = np.maximum(0,np.cos(a))
        mask = front**.75
        pigment = np.broadcast_to(self.base,(size,size,3)).copy()

        def shade(color, t):
            t = np.clip(t,0,1)[...,None]
            pigment[:] += (np.array(rgb(color))-pigment)*t

        def g(k):
            return np.exp(-k*k)

        warm = g((side-.101)/.048)*g((y+.056)/.038)
        shade('d98482' if self.woman else 'bd7c6d', warm*mask*(.32 if self.woman else .17))
        shade('dca28b', g((y+.060)/.030)*g(x/.035)*mask*.46)
        shade('915d56', g((y+.068)/.006)*g((side-.017)/.0056)*mask*.29)
        shade('c58c79', g((side-.056)/.056)*g((y+.016)/.028)*mask*.16)
        shade('a68174', (.30 if self.woman else .40)*(1-front)**1.50*g((y+.131)/.079))
        shade('f6d9bd', g((y-.078)/.073)*g((x+.02)/.084)*mask*.20)
        shade('f5d0b3',g((y+.163)/.023)*g(x/.055)*mask*.24)
        shade('a9786e',g((y+.139)/.011)*g(x/.042)*mask*.20)
        if not self.woman:
            stubble = g((y+.153)/.064)*(.44+.56*np.sin(u*1528+np.sin(v*692)*2+v*540)**4)
            shade('99786c', .22*stubble*front)

        line, full, top, bottom = self.lip_shape(x)
        d = y-line
        limit = np.maximum(np.where(d >= 0,top,bottom)*full,.0001)
        amount = np.clip((1-np.abs(d)/limit)*5,0,1)*mask
        amount *= np.clip((1-np.abs(x/self.mouth_w))*15,0,1)
        shade('c47b83' if self.woman else 'b68173', amount*.88)
        shade('743d41' if self.woman else '69423e',g(d/.00135)*amount*.64)
        shade('f3afaa' if self.woman else 'dfad97',g((d+.0051)/.0031)*amount*(.30+.08*np.cos(x*2500))*g(x/.032))
        shade('e8a99f',g((d+.0036)/.0016)*amount*.23*g((x+.013)/.015))
        grain = np.sin(u*941+np.sin(v*913)*1.7)*np.cos(v*719-u*211)
        pigment += (.0032*grain*mask)[...,None]

        # These two UV strips use the same skin and paint the lash line and lid fold.
        for upper,begin,end in ((False,.012,.115),(True,.136,.239)):
            islands = (v >= begin-.004) & (v <= end+.004)
            t = np.clip((v-begin)/(end-begin),0,1)
            arch = np.maximum(0,1-(2*u-1)**2)**.62
            eye_paint = np.broadcast_to(self.base,pigment.shape).copy()

            def eyelid(color, opacity):
                eye_paint[:] += (np.array(rgb(color))-eye_paint)*np.clip(opacity,0,1)[...,None]

            eyelid('b77b77' if self.woman else 'ad7864',arch*g((t-.19)/.25)*(.36 if upper else .13))
            if upper:
                eyelid('392428' if self.woman else '62463d',(g(t/.14)*.86+g((t-.44)/.078)*.12)*arch)
            else:
                eyelid('c18d7e',arch*g(t/.14)*.64)
            pigment[islands] = eye_paint[islands]
        pixels = np.ones((size,size,4),dtype=np.float32)
        pixels[:,:,:3] = np.clip(pigment,0,1)
        image = bpy.data.images.new('Hand-painted complexion',size,size,alpha=False)
        image.pixels.foreach_set(pixels.ravel())
        image.pack()
        return image

    def head(self, skin_mesh, eye_mesh):
        face = Mesh('Portrait and eyelids','Complexion',.72,self.paint())
        lip_levels = [self.mouth_y+d for d in (-.013,-.009,-.005,-.002,0,.002,.005,.009,.014)]
        facial_y = [LOW,-.195,-.179,-.165,-.150,-.138,*lip_levels,-.095,-.086,-.078,
                    -.071,-.064,-.057,-.050,-.041,-.030,-.019,-.008,0,.011,.024,
                    .046,.069,.094,.119,.143,.166,.186,.201,HIGH]
        facial_y.sort()
        # Dense, analytic surface sampling preserves the sculpted lip, nose and eye relief.
        facial_y = sorted(set(facial_y + [(a+b)*.5 for a,b in zip(facial_y,facial_y[1:])]))
        front = [-1.45+2.9*t for t in steps(85)]
        angles = [-pi+(pi-1.45)*t for t in steps(8)][:-1]+front
        angles += [1.45+(pi-1.45)*t for t in steps(8)][1:]
        rows = []
        for y in facial_y:
            rx,rz,z0 = profile(self.widths,y)
            row = []
            for a in angles:
                x = rx*sin(a)
                z = z0+rz*cos(a)+self.face_depth(x,y,cos(a))
                row.append((self.point(x,y,z),WHITE,HEAD,self.uv(a,y)))
            rows.append(row)
        start = face.grid(rows)
        def express(x,y,z):
            local = y-self.height
            corner = bell((abs(x)-.038)/.018)*bell((local-self.mouth_y)/.029)
            cheek = bell((abs(x)-.094)/.035)*bell((local+.044)/.038)
            strength = ramp(.050,.112,z)*(1-ramp(-.054,-.032,local))
            return (x*(1+.062*corner*strength),
                    y+.013*corner*strength+.004*cheek*strength,z+.003*cheek*strength)
        face.deformation('Smile',start,[express(*p) for p in face.points])
        for side, suffix in ((-1,'L'),(1,'R')):
            self.eye(face,eye_mesh,skin_mesh,side,suffix)
            self.ear(skin_mesh,side)
        return face

    def eye(self, face, eye_mesh, trim, side, suffix):
        outer = .046 if self.woman else .041
        cx = side*self.eye_x
        center = self.depth(cx,0)+(.016 if self.woman else .017)
        radius = .071
        # The eyeball wraps toward the temple. Alina's outer corners lift slightly.
        def globe(x,y):
            dx = x-cx
            return center-radius+sqrt(max(.0001,radius**2-dx**2-y**2))-side*dx*.27

        def edges(a):
            lift = side*a*(.0050 if self.woman else .0035)
            shape = max(0,1-a*a)**.66
            return (lift-(.0160 if self.woman else .0128)*shape, lift+(.0210 if self.woman else .0168)*shape)

        whites = []
        for v in steps(11):
            row = []
            for u in steps(45):
                a = 2*u-1
                lo,hi = edges(a)
                x,y = cx+outer*a,lo+(hi-lo)*v
                color = blend(rgb('f7eeea'),rgb('bcaaa5'),.22*v**2+.20*abs(a)**4)
                row.append((self.point(x,y,globe(x,y)),color,HEAD,(0,0)))
            whites.append(row)
        eye_mesh.grid(whites)

        iris = []
        for r in (.012,.21,.38,.46,.51,.59,.68,.77,.86,.93,.97,1):
            row = []
            for j in range(48):
                a = 2*pi*j/48
                pupil = rgb('211d22')
                dye = .19+.27*max(0,-sin(a))+.13*cos(a*11+.7)**2
                color = blend(self.iris,rgb('cfc5a2' if self.woman else 'c5a776'),dye)
                if r >= .95:
                    color = blend(color,rgb('28353b'),.78 if r == 1 else .51)
                if r < .52:
                    color = blend(color,pupil,.97 if r < .41 else .59)
                rx,ry = (.0220,.0230) if self.woman else (.0178,.0195)
                x = cx + r*rx*cos(a)
                lo,hi = edges((x-cx)/outer)
                y = max(lo-.0001,min(hi+.0002,.001+r*ry*sin(a)))
                row.append((self.point(x,y,globe(x,y)+.0011),color,solid('Eye'+suffix),(0,0)))
            iris.append(row)
        eye_mesh.grid(iris,closed=True,flip=True)
        for px,py,r in ((-.0043,.0061,.00265),(.005,-.004,.00105)):
            points = [(self.point(cx+px+cos(a)*r,py+sin(a)*r*.86,
                                  globe(cx+px+cos(a)*r,py+sin(a)*r*.86)+.0021),
                       rgb('fff4ee'),solid('Eye'+suffix),(0,0))
                      for a in (0,pi/3,2*pi/3,pi,4*pi/3,5*pi/3,2*pi)]
            center_point = (self.point(cx+px,py,globe(cx+px,py)+.0021),rgb('fff4ee'),solid('Eye'+suffix),(0,0))
            eye_mesh.grid([points,[center_point]*len(points)])

        for upper in (False,True):
            direction = 1 if upper else -1
            patch, closed = [], []
            for t in (0,.055,.11,.17,.23,.315,.40,.515,.63,.815,1):
                row, shut = [], []
                for u in steps(49):
                    a = 2*u-1
                    shell = max(0,1-a*a)**.70
                    x = cx+a*(outer+.010*t)
                    lo,hi = edges(a)
                    rim = hi if upper else lo
                    y = rim + t*direction*(.007+(.020 if upper else .012)*shell)
                    def lid_z(at,closing):
                        feather = ramp(.30,.99,t) if closing else smooth(t/(.76 if upper else .62))
                        blend_depth = max(feather,ramp(.84,1.16,abs(x-cx)/outer))
                        g = globe(x,at)+(.013 if closing else .0015)
                        return g+(self.depth(x,at)-.0012-g)*blend_depth
                    moved = y+(-.0030*shell-rim)* (1-smooth(t/.94))
                    uv = (u,.136+.103*t if upper else .012+.103*t)
                    row.append((self.point(x,y,lid_z(y,False)),WHITE,HEAD,uv))
                    shut.append(self.point(x,moved,lid_z(moved,True)))
                patch.append(row)
                closed.extend(shut)
            start = face.grid(patch,flip=not upper)
            face.deformation('CloseLids',start,closed)

        # Fine taper at the corner. Bind the strokes to the blinking mesh.
        if self.woman:
            for i in range(9):
                a = side*(.12+i*.093)
                x = cx+outer*a
                _, y = edges(a)
                tip = side*(.0027+.00027*i)
                rows = []
                shut = []
                for t in (0,.42,.72,1):
                    xx = x+tip*t
                    yy = y+(.0040+.00046*i)*t*t
                    zz = globe(xx,yy)+.0035
                    close_y = yy + (-.0030*max(0,1-a*a)**.7-y)*(1-.5*t)
                    breadth = (.0011*(1-t)+.00011)
                    uv = (.57,.138)
                    rows.append([(self.point(xx+dx,yy,zz),WHITE,HEAD,uv) for dx in (-breadth,breadth)])
                    shut.extend(self.point(xx+dx,close_y,globe(xx,close_y)+.014) for dx in (-breadth,breadth))
                start = face.grid(rows)
                face.deformation('CloseLids',start,shut)

        brow = ((-.037,.036),(-.027,.041),(-.014,.045),(0,.047),
                (.014,.048 if self.woman else .045),(.026,.044 if self.woman else .040),(.040,.033))
        radii = (.0012,.0042,.0045,.0041,.0033,.0024,.0005)
        path = []
        for t in steps(19):
            i = min(int(t*6),5)
            p,q = brow[i:i+2]
            before,after = brow[max(0,i-1)],brow[min(6,i+2)]
            f = t*6-i
            dx,y = (spline(a,b,(b-low)*.5,(high-a)*.5,f)
                    for a,b,low,high in zip(p,q,before,after))
            x = cx+side*dx
            path.append((self.point(x,y,self.depth(x,y)+.0015),
                         radii[i]+(radii[i+1]-radii[i])*f))
        trim.cord(path,self.brow,HEAD,sides=5,thickness=.38)

    def ear(self, mesh, side):
        outline = [(-.041,.004,.007,.005),(-.028,.015,.015,.001),(-.002,.021,.018,0),
                   (.025,.020,.014,-.009),(.040,.009,.009,-.010),(.047,.003,.003,-.012)]
        def warp(x,y,z,a,t):
            return x+side*y*.22,y,z-.009*max(0,cos(a))**2*bell(y/.026)
        mesh.lathe(outline,(side*.139,self.height-.039,-.014),
                   lambda t,a: blend(self.base,rgb('b98276'),.56*bell((t-.46)/.22)*max(0,cos(a))),
                   lambda t:HEAD,rings=9,sides=12,warp=warp)
        if self.woman:
            path = [(self.point(side*(.145+.010*sin(a)),-.080+.011*cos(a),.002),.0016)
                    for a in (0,.75,1.5,2.25,3,3.75,4.5,5.25,6.28)]
            mesh.cord(path,rgb('c0a175'),HEAD,sides=5)

    def hair(self):
        hair = Mesh('Sculpted hairstyle','Hair pigment',.55,self.hair_paint())
        if self.woman:
            self.curtain(hair)
        else:
            self.crop(hair)
        return hair

    def hair_paint(self):
        width, height = 1024, 512
        u,v = np.meshgrid((np.arange(width)+.5)/width,(np.arange(height)+.5)/height)
        a = (u-.5)*2*pi
        def fade(left,right,value):
            t = np.clip((value-left)/(right-left),0,1)
            return t*t*(3-2*t)
        def mix(first,second,factor):
            return first+(second-first)*factor[...,None]
        if self.woman:
            flow = 12*u*2*pi+.92*np.sin(v*8+u*5)+.44*np.sin(v*19-u*12)
            section = (.5+.5*np.cos(flow))**2.4
            strand = .5+.5*np.cos(flow*6.9+np.sin(flow*2.3)*1.4)
            thread = .5+.5*np.cos(flow*12.7+.8)
            lit = mix(np.array(rgb('977450')),np.array(rgb('e3c79b')),
                      .33+.30*section+.12*strand+.045*thread+.16*(1-fade(.1,.69,v)))
            part = np.exp(-(np.minimum(u,1-u)/.035)**2)*np.exp(-((v-.91)/.13)**2)
            roots = .51*fade(.58,.98,v)+.16*part
            painted = mix(lit,np.array(rgb('69503d')),roots)
        else:
            front = np.maximum(0,np.cos(a))
            flow = a*11+v*13+2.1*np.sin(a-v*2.1)+.47*np.cos(3*a+v*2.8)
            section = (.5+.5*np.cos(flow))**3
            strand = .5+.5*np.cos(flow*6+np.sin(flow*2)*1.5)
            thread = .5+.5*np.cos(flow*11+.7)
            painted = mix(np.array(rgb('2f201b')),np.array(rgb('866653')),
                          .15+.29*section+.12*strand+.06*thread+.20*front*np.sin(pi*v))
            fade_edge = (1-front**2)*np.exp(-(v/.17)**2)
            painted = mix(painted,np.array(rgb('9a7865')),.56*fade_edge)
        pixels = np.ones((height,width,4),dtype=np.float32)
        pixels[:,:,:3] = np.clip(painted,0,1)
        image = bpy.data.images.new('Directional hair pigment',width,height,alpha=False)
        image.pixels.foreach_set(pixels.ravel())
        image.pack()
        return image

    def crop(self, hair):
        dark, warm, fade = map(rgb,('2b201e','654638','816052'))
        rows = []
        for t in steps(42):
            row = []
            for u in steps(115):
                a = (u-.5)*2*pi
                front, side = cos(a),sin(a)
                f = max(0,front)
                edge = .035 + .071*f**.84 - .123*max(0,-front)**.94
                edge += .014*f*sin(a+.68)+.006*f*cos(a*3+.14)
                h = edge+(HIGH-edge)*(1-(1-t)**1.17)
                rx,rz,z0 = profile(self.widths,h)
                swell = sin(pi*t)**.90
                flow = a*11+t*13+2.1*sin(a-t*2.1)+.47*cos(3*a+t*2.8)
                strand = (.5+.5*cos(flow))**3
                fiber = .5+.5*cos(flow*2.1+.9)
                quiff = (.025+.045*f)*f*swell*(.84+.37*side)
                taper = (1-f**2)*bell(t/.18)
                loft = .0032+swell*(.005+.025*f+.005*strand)
                x = (rx+loft)*side - .029*swell*f
                z = z0 + (rz+loft)*front + quiff*.32
                y = h+quiff+.019*t
                c = blend(dark,warm,.13+.28*strand+.09*fiber+.19*f*swell)
                c = blend(c,fade,taper*.67)
                row.append((self.point(x,y,z),c,HEAD,(u,t)))
            rows.append(row)
        hair.grid(rows)
        hair.faces.append(tuple(range(len(hair.points)-len(rows[-1]),len(hair.points))))

    def curtain(self, hair):
        crown = [(-.417,.156,.117,-.031),(-.340,.175,.135,-.026),(-.248,.170,.135,-.018),
                 (-.160,.165,.145,-.024),(-.078,.165,.157,-.016),
                 (.0,.160,.161,-.014),(.084,.157,.161,-.020),(.138,.144,.145,-.027),
                 (.179,.112,.112,-.029),(.208,.074,.077,-.032),(.230,.039,.046,-.035),(.236,.007,.009,-.036)]
        split = [(-.43,1.10),(-.150,1.04),(-.025,1.05),(.037,.94),(.087,.72),
                 (.132,.48),(.157,.22),(.180,.033),(.208,.012),(.236,.009)]
        root, base, sand = map(rgb,('584439','997956','d6b784'))
        shoulder = -.411
        heights = [shoulder + .59*t for t in steps(51)]+[.191,.204,.215,.223,.230,.234,.236]
        rows = []
        for y0 in heights:
            t = (y0-shoulder)/(.236-shoulder)
            row = []
            for u in steps(112):
                hem = sin(u*4*pi+.7)*.022+cos(u*9*pi+1.24)*.014 + .008*sin(u*13*pi+.4)
                y = y0+hem*(1-ramp(0,.27,t))
                opening, = profile(split,y)
                part = -.105-.095*bell((y-.133)/.052)
                a = opening+(2*pi-2*opening)*u+part
                rx,rz,z0 = profile(crown,y)
                if -.08 < y < HIGH:
                    # Maintain room for the skull as the two drapes meet at the crown.
                    head_x,head_z,head_center = profile(self.widths,y)
                    clearance = .018 + .014*bell((y-.122)/.065)
                    rx = max(rx,head_x+clearance)
                    rz = max(rz,head_z+clearance+abs(z0-head_center))
                flow = u*2*pi*12 + .92*sin(t*8+u*5) + .44*sin(t*19-u*12)
                strand = (.5+.5*cos(flow))**2.5
                thread = (.5+.5*cos(flow*2.13+.48))**2
                texture = (.0092*strand+.0072*cos(u*2*pi*5+t*5))*sin(pi*t)**.73
                side = min(u,1-u)
                face_lock = bell(side/.047)
                curve = .019*sin(y*13+u*5)*bell((y+.17)/.28)
                x = sin(a)*(rx+texture)+curve
                z = z0+cos(a)*(rz+texture)+face_lock*.035*bell((y+.09)/.175)
                root_tint = ramp(.028,.194,y)*.74
                warm = blend(base,sand,.22+.29*strand+.095*thread+.22*(1-ramp(-.32,.024,y)))
                groove = bell(side/.025)*bell((y-.177)/.045)*.24
                c = blend(warm,root,root_tint+groove*(1-root_tint))
                row.append((self.point(x,y,z),c,skin('Hair','Head',(y+.18)/.254),(u,t)))
            rows.append(row)
        start = hair.grid(rows)
        width = len(rows[0])
        for i,h in enumerate(heights[:-1]):
            if h > .179:
                first = start+i*width
                hair.faces.append((first+width-1,first,first+width,first+width*2-1))
        upper = start+(len(rows)-1)*width
        hair.faces.append(tuple(range(upper,upper+width)))
        # Roll the exposed hairline back into the shell at the temples.
        for side,j in ((1,0),(-1,-1)):
            roll = []
            for row,h in zip(rows,heights):
                (x,y,z),c,w,uv = row[j]
                thickness = 1-ramp(.119,.196,h)
                roll.append([((x,y,z),c,w,uv),
                             ((x-side*.003*thickness,y-.002*thickness,z-.009*thickness),c,w,uv),
                             ((x-side*.009*thickness,y-.004*thickness,z-.017*thickness),blend(c,root,.37),w,uv)])
            hair.grid(roll,flip=side<0)

        # Sculpt layered, tapered front locks over the existing continuous shell.
        # Same material, same skin weights, no extra draw calls.
        for side in (-1,1):
            for lock in range(3):
                ribbon=[]
                for k in range(3,len(rows)-8):
                    row=rows[k];h=heights[k];t=(h-shoulder)/(.236-shoulder)
                    envelope=sin(pi*max(0,min(1,(t-.04)/.88)))**.85
                    center=.037+.055*lock+.027*sin(t*6+lock*.9)
                    width=.021+.010*envelope
                    section=[]
                    for u in steps(13):
                        q=center+(u-.5)*width*2
                        if side<0:q=1-q
                        f=max(0,min(len(row)-1.001,q*(len(row)-1)))
                        idx=int(f);mix=f-idx
                        p0,c,w,uv=row[idx];p1,_,_,uv1=row[idx+1]
                        x,y,z=tuple(a+(b-a)*mix for a,b in zip(p0,p1))
                        uv=tuple(a+(b-a)*mix for a,b in zip(uv,uv1))
                        lift=.012*envelope*sin(pi*u)**.7
                        # Push outward, leaving the face and the armature intact.
                        section.append(((x+side*lift*.65,y,z+lift),c,w,uv))
                    ribbon.append(section)
                hair.grid(ribbon,flip=side<0)
