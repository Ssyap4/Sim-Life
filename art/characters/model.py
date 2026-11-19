"""Editable control surfaces for the Sim-Life residents, in game-space metres."""

from math import atan2, cos, exp, pi, sin, sqrt

import bpy
from mathutils import Vector


def xyz(point):
    x, y, z = point
    return x, -z, y


def srgb(hex_value):
    raw = bytes.fromhex(hex_value)
    return tuple(c / 255 / 12.92 if c < 11 else ((c / 255 + .055) / 1.055) ** 2.4 for c in raw)


def mix(a, b, amount):
    return tuple(x + (y - x) * amount for x, y in zip(a, b))


def ease(t):
    t = min(1, max(0, t))
    return t * t * (3 - 2 * t)


def bell(t):
    return exp(-t * t)


def samples(count):
    return (i / (count - 1) for i in range(count))


def section_at(sections, y):
    last = len(sections) - 1
    i = next((i for i in range(last) if y <= sections[i + 1][0]), last - 1)
    p, q = sections[i:i + 2]
    distance = q[0] - p[0]
    t = min(1, max(0, (y - p[0]) / distance))
    before, after = sections[max(i - 1, 0)], sections[min(i + 2, last)]
    return tuple(
        (2*t**3 - 3*t*t + 1)*a + (t**3 - 2*t*t + t)*distance*(b - u)/(q[0] - before[0])
        + (-2*t**3 + 3*t*t)*b + (t**3 - t*t)*distance*(v - a)/(after[0] - p[0])
        for a, b, u, v in zip(p[1:], q[1:], before[1:], after[1:])
    )


class Surface:
    """A named skin or garment piece with per-vertex palette and bind weights."""

    def __init__(self, name, material):
        self.name = name
        self.material = material
        self.points = []
        self.colors = []
        self.weights = []
        self.faces = []

    def patch(self, rows, closed=False, caps=False):
        start = len(self.points)
        width = len(rows[0])
        for row in rows:
            for point, color, weights in row:
                self.points.append(xyz(point))
                self.colors.append((*color, 1))
                self.weights.append(weights)
        for r in range(len(rows) - 1):
            for i in range(width if closed else width - 1):
                a = start + r * width + i
                b = start + r * width + (i + 1) % width
                self.faces.append((a, b, b + width, a + width))
        if caps:
            self.faces.append(tuple(start + i for i in reversed(range(width))))
            top = start + width * (len(rows) - 1)
            self.faces.append(tuple(top + i for i in range(width)))

    def build(self, rig):
        data = bpy.data.meshes.new(self.name)
        data.from_pydata(self.points, [], self.faces)
        data.update()
        obj = bpy.data.objects.new(self.name, data)
        bpy.context.collection.objects.link(obj)
        obj.parent = rig
        data.materials.append(self.material)
        colors = data.color_attributes.new(name='Pigment', type='FLOAT_COLOR', domain='POINT')
        colors.data.foreach_set('color', [value for color in self.colors for value in color])
        groups = {}
        for index, weights in enumerate(self.weights):
            for bone, weight in weights.items():
                if weight < .0001:
                    continue
                if bone not in groups:
                    groups[bone] = obj.vertex_groups.new(name=bone)
                groups[bone].add([index], weight, 'REPLACE')
        data.polygons.foreach_set('use_smooth', [True] * len(data.polygons))
        deform = obj.modifiers.new(name='Resident skin', type='ARMATURE')
        deform.object = rig
        return obj


def material(name, roughness, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    vertex = mat.node_tree.nodes.new('ShaderNodeVertexColor')
    vertex.layer_name = 'Pigment'
    mat.node_tree.links.new(vertex.outputs['Color'], shader.inputs['Base Color'])
    return mat


def shell(surface, sections, center, pigment, bind, rings=18, sides=24, flow=None, opening=None,
          front_only=False):
    rows = []
    for t in samples(rings):
        y = sections[0][0] + (sections[-1][0] - sections[0][0]) * t
        rx, rz, z0 = section_at(sections, y)
        gap = opening(y) if opening else 0
        start, end = (-.89,.89) if front_only else (gap,2*pi-gap)
        row = []
        for side in range(sides):
            a = start + (end - start) * side / (sides - bool(opening or front_only))
            x, z = sin(a)*max(rx, .001), z0 + cos(a)*max(rz, .001)
            if flow:
                x, z = flow(x, y, z, a)
            row.append(((x + center[0], y + center[1], z + center[2]), pigment(y, a), bind(y)))
        rows.append(row)
    closed = not opening and not front_only
    surface.patch(rows, closed=closed, caps=closed)


def solid(bone):
    return lambda _y: {bone: 1}


def weighted(bottom, top, y, low, high):
    blend = ease((y - low) / (high - low))
    return {bottom: 1 - blend, top: blend}


def uniform(color):
    return lambda _y, _a: color


def curve_points(points, count):
    points = [Vector(p) for p in points]
    last = len(points)-1
    for t in samples(count):
        pos = t*last
        i = min(int(pos), last-1)
        f = pos-i
        a, b = points[i:i+2]
        m = (b - points[max(0, i-1)]) * .5
        n = (points[min(last, i+2)] - a) * .5
        yield a*(2*f**3-3*f*f+1) + m*(f**3-2*f*f+f) + b*(-2*f**3+3*f*f) + n*(f**3-f*f)


def seam(surface, points, width, depth, color, bone, count=12, sides=6, taper=.35):
    path = list(curve_points(points, count))
    rows = []
    for i, point in enumerate(path):
        tangent = (path[min(i+1, count-1)] - path[max(i-1, 0)]).normalized()
        lateral = tangent.cross(Vector((0,0,1)))
        if lateral.length < .001:
            lateral = tangent.cross(Vector((0,1,0)))
        lateral.normalize()
        normal = tangent.cross(lateral)
        thickness = taper + (1-taper) * sin(pi*i/(count-1)) ** .56
        row = []
        for j in range(sides):
            a = 2*pi*j/sides
            p = point + lateral*(width*cos(a)*thickness) + normal*(depth*sin(a)*thickness)
            row.append((p, color, {bone: 1}))
        rows.append(row)
    surface.patch(rows, closed=True, caps=True)


class Resident:
    def __init__(self, name):
        self.name = name
        self.woman = name == 'alina'
        self.hip = .852 if self.woman else .905
        self.shoulder = 1.328 if self.woman else 1.389
        self.neck = 1.454 if self.woman else 1.503
        self.head_y = self.neck + .26
        self.arm = .270 if self.woman else .296
        self.forearm = .284 if self.woman else .304
        self.thigh = self.hip*.45
        self.shin = self.hip - self.thigh - .084
        self.arm_x = .193 if self.woman else .22
        self.eye_y = self.head_y + (.016 if self.woman else .014)
        self.eye_x = .067 if self.woman else .063

        colors = (
            dict(skin='e5b49d', cheek='cd8d85', lip='aa6664', hair='866044', hair_light='d6b684',
                 shirt='eee4d4', jacket='a76857', hem='78473e', denim='504751', sole='bd9b80', shoe='936d58',
                 iris='6b775c')
            if self.woman else
            dict(skin='cfa187', cheek='bd8576', lip='86524c', hair='252221', hair_light='554335',
                 shirt='eae2ce', jacket='456675', hem='294954', denim='445866', sole='c3a489', shoe='7a6455',
                 iris='69736e')
        )
        self.c = {name: srgb(value) for name, value in colors.items()}

    def rig(self):
        data = bpy.data.armatures.new('Resident armature')
        rig = bpy.data.objects.new('Resident', data)
        bpy.context.collection.objects.link(rig)
        bpy.context.view_layer.objects.active = rig
        rig.select_set(True)
        rig.show_in_front = True
        bpy.ops.object.mode_set(mode='EDIT')

        def add(name, point, parent=None):
            bone = data.edit_bones.new(name)
            bone.head = xyz(point)
            # Bone local +Y maps to world +Y after the glTF axis conversion.
            bone.tail = bone.head + Vector((0, 0, .08))
            if parent:
                bone.parent = data.edit_bones[parent]

        add('Pelvis', (0,0,0))
        add('Chest', (0,0,0), 'Pelvis')
        add('Head', (0,self.head_y,.030), 'Chest')
        add('Hair', (0,self.head_y,.030), 'Head')
        for side, suffix in [(-1, 'L'), (1, 'R')]:
            add('Eye'+suffix, (side*self.eye_x,self.eye_y,.163), 'Head')
            add('Arm'+suffix, (side*self.arm_x,self.shoulder,0), 'Chest')
            add('Elbow'+suffix, (side*self.arm_x,self.shoulder-self.arm,0), 'Arm'+suffix)
            add('Wrist'+suffix, (side*self.arm_x,self.shoulder-self.arm-self.forearm,0), 'Elbow'+suffix)
            add('Thigh'+suffix, (side*.111,self.hip,0), 'Pelvis')
            add('Knee'+suffix, (side*.111,self.hip-self.thigh,0), 'Thigh'+suffix)
            add('Ankle'+suffix, (side*.111,.084,0), 'Knee'+suffix)
        bpy.ops.object.mode_set(mode='OBJECT')
        rig['character'] = self.name
        rig['waistY'] = self.hip - .061
        return rig

    def face(self, skin, eyes):
        c = self.c
        # Separate silhouette sections around the jaw hinge, cheekbones, brow and temples.
        w = self.woman
        profile = [
            (-.213,.038,.047,.049),(-.197,.073,.074,.041),(-.164,.106 if w else .110,.096,.028),
            (-.111,.132 if w else .128,.115,.014),(-.063,.152 if w else .144,.126,.005),
            (-.020,.153 if w else .148,.131,.002),(.043,.149 if w else .147,.132,-.001),
            (.091,.145,.125,-.008),(.147,.118,.107,-.015),(.191,.070,.070,-.021),(.208,.003,.003,-.022)
        ]
        def form(x, y, z, a):
            front = max(0, cos(a))
            xabs = abs(x)
            root = bell((y-.013)/.040) * bell(x/.024)
            bridge = bell((y+.029)/.052) * bell(x/.023)
            tip = bell((y+.065)/.018) * bell(x/.024)
            wing = bell((y+.071)/.012) * bell((xabs-.024)/.012)
            socket = bell((y-(.016 if w else .014))/.023) * bell((xabs-self.eye_x)/.033)
            cheekbone = bell((y+.034)/.029) * bell((xabs-.106)/.037)
            mouth = bell((y+.112)/.035) * bell(x/.058)
            chin = bell((y+.177)/.029) * bell(x/.052)
            return x, z + front*(.013*root + (.033 if w else .040)*bridge
                + .027*tip + .012*wing - .013*socket + .014*cheekbone + .015*mouth + .011*chin)

        def color(y, a):
            cheek = max(0,cos(a)) * sin(a*2)**2 * bell((y+.065)/.048)
            shadow = (1-ease((y+.195)/.045))*max(0,cos(a))
            return mix(c['skin'],c['cheek'],.38*cheek + .16*shadow)

        center = (0,self.head_y,.030)
        shell(skin,profile,center,color,solid('Head'),rings=32,sides=38,flow=form)

        def front(x, y):
            rx, rz, z0 = section_at(profile, y)
            a = atan2(x/max(rx,.001), sqrt(max(0,1-(x/max(rx,.001))**2)))
            return form(x,y,z0+cos(a)*rz,a)[1]+center[2]

        def face_point(x,y,raise_by=.003):
            return x,self.head_y+y,front(x,y)+raise_by

        for side, suffix in [(-1,'L'),(1,'R')]:
            # Helix and concha are one weighted ear surface with shading at the rim.
            def ear(x,y,z,a):
                return x + side*y*.20, z + cos(a)*.006*bell((y-.003)/.025)
            shell(skin,[(-.048,.009,.009,0),(-.031,.023,.015,0),(.02,.028,.017,0),
                        (.044,.015,.009,0),(.048,.004,.004,0)],
                  (side*.147,self.head_y-.046,.012),lambda y,a:mix(c['skin'],c['cheek'],.55*max(0,cos(a))*bell(y/.027)),
                  solid('Head'),rings=10,sides=12,flow=ear)
            cx = side*self.eye_x
            cy = self.eye_y-self.head_y
            half = .036 if w else .034
            height = .016 if w else .0135
            iris = c['iris']
            white, lid, pupil, glint = map(srgb, ('ebe1d7','49302e','181618','fff3df'))

            def aperture(a, v, offset=0):
                contour = max(0,1-a*a)**.90
                x = cx + a*half
                y = cy + (2*v-1)*height*contour*(.74 if v < .5 else 1) + side*a*height*.13
                z = front(x,y)+.004+.008*contour*(1-.54*(2*v-1)**2)+offset
                return x,self.head_y+y,z

            opening = []
            for v in samples(7):
                row = []
                for u in samples(21):
                    a = 2*u-1
                    edge = ease((v-.82)/.18)*.89 + (1-ease(v/.14))*.50
                    tint = mix(white,lid,edge+.1*abs(a))
                    row.append((aperture(a,v),tint,{'Eye'+suffix:1}))
                opening.append(row)
            eyes.patch(opening)

            # Concentric loops delineate the pupil and iris without putting a
            # separate sphere outside the lid. Both sit inside the same aperture.
            rings = []
            for radius in [.015,.38,.43,.52,.74,.93,1]:
                row = []
                for i in range(21):
                    angle = 2*pi*i/21
                    a = cos(angle)*radius*.42
                    v = .49 - sin(angle)*radius*.48
                    light = .07+.36*max(0,-sin(angle))+.07*cos(angle*9)**2
                    fibers = mix(iris,srgb('d6ab75'),light) if radius < .93 else mix(iris,lid,.64)
                    tint = pupil if radius < .43 else fibers
                    row.append((aperture(a,v,.0018),tint,{'Eye'+suffix:1}))
                rings.append(row)
            eyes.patch(rings,closed=True)

            # A glimpse of the window across the iris.
            reflection = []
            for v in [.60,.68]:
                reflection.append([(aperture(a,v,.0027),glint,{'Eye'+suffix:1}) for a in [-.145,-.064]])
            eyes.patch(reflection)

            # The brow follows the skin instead of hovering in front of the socket.
            brow = [face_point(cx+side*dx,cy+dy,.004) for dx,dy in
                    [(-.036,.032),(-.015,.038),(.006,.040 if w else .037),(.027,.035),(.038,.029)]]
            seam(skin,brow,.0051 if w else .0059,.0022,mix(c['hair'],c['cheek'],.31 if w else .13),
                 'Head',count=12,taper=.18)

        # Two planes of the lip around a shallow central crease. Palette fades at the corners.
        lips = []
        for v in samples(5):
            row = []
            for u in samples(21):
                a = 2*u-1
                width = .036 if w else .033
                x = width*a
                edge = max(0,1-a*a)
                y = -.123 + .004*a*a
                y += (2*v-1)*edge*(.0058 if v < .5 else .0045)
                y += .0018*bell((abs(a)-.30)/.19)*v
                z = front(x,y)+.002+.004*edge*sin(pi*v)
                tint = mix(c['skin'], c['lip'], edge*(.24+.64*bell((v-.49)/.28))+.13)
                row.append(((x,self.head_y+y,z),tint,{'Head':1}))
            lips.append(row)
        skin.patch(lips)

    def hair(self, surface):
        c = self.c
        w = self.woman
        profile = [
            (-.082,.155,.138,.002), (-.023,.163,.146,.004), (.049,.161,.161,.004),
            (.108,.156,.157,-.002), (.156,.141,.147,-.009), (.192,.114,.119,-.017),
            (.220,.073,.078,-.024), (.239,.028,.040,-.028), (.250,.001,.001,-.031),
        ]
        rows = []
        for t in samples(20):
            row = []
            for i in range(38):
                a = 2*pi*i/38
                frontal = ease((cos(a)+.18)/1.10)
                temple = sin(a)**2
                edge = -.080 + frontal*(.163 if w else .176) + temple*(.049 if w else .074)
                edge -= .019*sin(a*2+.14)*frontal
                y = edge+(.250-edge)*t
                rx, rz, center = section_at(profile,y)
                part = a*13+4*t+sin(a+t*1.7)*2.16
                groove = cos(part)*.0043*sin(pi*t)
                top_weight = sin(pi*t)**1.45
                x = sin(a)*(rx+groove) + top_weight*(.014 if w else .017)
                z = center + cos(a)*(rz+groove)
                y += frontal*top_weight*(.009 if w else .016)
                edge_tint = .10*(1-ease(t/.20))*temple
                highlight = .17+edge_tint+(.56 if w else .47)*(.5+.5*cos(part))**2
                color = mix(c['hair'],c['hair_light'],highlight)
                row.append(((x,self.head_y+y,z),color,{'Head':1}))
            rows.append(row)
        surface.patch(rows,closed=True)
        if w:
            for side in (-1,1):
                for index, offset in enumerate((0,.048,.092)):
                    glow = mix(c['hair'],c['hair_light'],(.55,.38,.62)[index])
                    # Long S-shaped panels wrap around the ear and leave the profile open.
                    path = [
                        (side*(.086+offset*.59),self.head_y+.168,.060-offset),
                        (side*(.146+offset*.37),self.head_y+.067,.133-offset),
                        (side*(.167+offset*.43),self.head_y-.099,.104-offset),
                        (side*(.175+offset*.35),self.head_y-.220,.126-offset),
                        (side*(.147+offset*.43),self.head_y-.348,.086-offset),
                        (side*(.153+offset*.29),self.head_y-.399+offset*.45,.049-offset),
                    ]
                    seam(surface,path,.050-index*.004,.021,glow,'Hair',count=17,sides=9,taper=.25)
            back = [(-.38,.062,.020,-.102),(-.335,.149,.043,-.112),(-.23,.176,.057,-.122),
                    (-.09,.179,.067,-.110),(.087,.133,.057,-.090),(.155,.041,.030,-.067)]
            shell(surface,back,(0,self.head_y,0),
                  lambda t,a:mix(c['hair'],c['hair_light'],.27+.31*(.5+.5*cos(a*8+t*22))),
                  solid('Hair'),rings=18,sides=28,
                  flow=lambda x,y,z,a:(x+.012*sin(y*14),z+.010*cos(a*7+y*20)))

    def garments(self, woven, skin, leather):
        c = self.c
        h = self.hip
        w = self.woman
        s = self.shoulder
        body = [(h-.065,.182,.102,0),(h+.001,.184,.120,0),(h+.136,.165 if w else .177,.105,-.007),
                (s-.12,.194 if w else .207,.119,.008),(s-.023,.187 if w else .216,.102,-.004),
                (s+.071,.138,.083,-.010),(self.neck,.074,.065,-.008)]
        shell(woven,body,(0,0,0),lambda y,a:mix(c['shirt'],srgb('9f8e76'),.20*max(0,-cos(a))),
              solid('Chest'),rings=14,sides=18,front_only=True)

        def gap(y):
            return .22+.34*ease((y-s+.24)/.34)

        jacket = [(y,x+.015,z+.016,center) for y,x,z,center in body]
        def coat_flow(x,y,z,a):
            ripple=.006*cos(a*7+y*28)*bell((y-h)/.16)
            return x+sin(a)*ripple,z+cos(a)*ripple

        def coat_color(y,a):
            hem = 1-ease((y-(h-.065))/.048)
            edge = bell((min(a,2*pi-a)-gap(y))/.23)
            return mix(c['jacket'],c['hem'],.56*hem+.48*edge + .14*max(0,-cos(a)))

        shell(woven,jacket,(0,0,0),coat_color,solid('Chest'),rings=19,sides=32,flow=coat_flow,opening=gap)
        for side in (-1,1):
            points=[]
            for y in [h-.060,h+.045,s-.25,s-.08,s+.052,self.neck-.005]:
                x,z,z0=section_at(jacket,y)
                angle=gap(y)
                # The facings tuck under when the collar narrows.
                points.append((side*(x*sin(angle)+.004),y,z0+z*cos(angle)+.004))
            seam(woven,points,.012,.004,c['hem'],'Chest',sides=7,taper=.65)
            seam(woven,[(side*.074,h+.075,.124),(side*.116,h+.100,.122),
                        (side*.152,h+.179,.103)],.005,.003,c['hem'],'Chest',count=8)

        collar = [(self.neck-.022,.080,.073,-.010), (self.neck-.006,.079,.072,-.010),
                  (self.neck+.008,.072,.066,-.008)]
        shell(woven,collar,(0,0,0),uniform(mix(c['shirt'],c['hem'],.14)),
              solid('Chest'),rings=5,sides=18)
        neck = [(self.neck-.04,.071,.067,-.014),(self.neck+.052,.063,.060,-.011),
                (self.neck+.126,.070,.063,.013),(self.neck+.166,.077,.070,.030)]
        shell(skin,neck,(0,0,0),uniform(c['skin']),solid('Chest'),rings=12,sides=18)
        shell(woven,[(h-.11,.146,.081,0),(h-.06,.191,.098,-.009),(h+.052,.170,.109,-.009)],
              (0,0,0),uniform(c['denim']),solid('Pelvis'),rings=8,sides=18)

        for side,suffix in [(-1,'L'),(1,'R')]:
            a,f = self.arm,self.forearm
            sleeve = [(-a-f+.020,.041,.037,-.002),(-a-f+.058,.045,.042,-.003),
                      (-a-.125,.060,.051,0),(-a,.058,.057,.005),(-.125,.066,.067,.005),
                      (-.040,.076,.074,0),(.028,.063,.068,-.006),(.083,.030,.048,-.002)]
            def cuff(y, angle):
                band=1-ease((y+a+f-.045)/.052)
                return mix(c['jacket'],c['hem'],.67*band+.10*max(0,-cos(angle)))
            def sleeve_weights(y):
                if y > -.08:
                    return weighted('Arm'+suffix,'Chest',y,-.08,.085)
                return weighted('Elbow'+suffix,'Arm'+suffix,y,-a-.088,-a+.10)
            shell(woven,sleeve,(side*self.arm_x,s,0),cuff,sleeve_weights,rings=16,sides=16,
                  flow=lambda x,y,z,angle:(x-side*.028*ease((y+.015)/.098),
                       z+.004*cos(31*y+angle*2)*bell((y+a)/.15)))
            wrist = (side*self.arm_x,s-a-f,0)
            shell(skin,[(-.096,.023,.013,.010),(-.076,.031,.019,.009),(-.040,.035,.023,.001),
                        (-.014,.030,.022,-.002),(.037,.031,.027,0)],wrist,uniform(c['skin']),
                  solid('Wrist'+suffix),rings=12,sides=15)
            thumb = [(wrist[0]-side*x,wrist[1]+y,z) for x,y,z in
                     [(.020,-.019,.003),(.036,-.039,.016),(.038,-.060,.023),(.029,-.072,.025)]]
            seam(skin,thumb,.012,.014,c['skin'],'Wrist'+suffix, count=9,sides=8)
            for finger in range(4):
                x = wrist[0]+side*(finger-.5)*.014-.010*side
                tip = wrist[1]-.104+abs(finger-1.4)*.005
                shell(skin,[(tip,.004,.004,.014),(tip+.008,.007,.009,.012),(tip+.027,.008,.010,.002)],
                      (x,0,0),uniform(c['skin']),solid('Wrist'+suffix),rings=4,sides=7)

            knee = self.thigh
            leg = [(-self.hip+.058,.056,.058,.002),(-self.hip+.124,.063,.063,-.006),
                   (-knee-.16,.073,.080,-.016),(-knee,.074,.075,.008),
                   (-.214,.086,.092,-.014),(-.117,.094,.100,-.017),
                   (.006,.091,.096,-.015),(.070,.054,.071,-.006)]
            def denim(y, angle):
                seam_line=bell((abs(sin(angle))-.99)/.047)
                return mix(c['denim'],srgb('8a99a0'),.13*max(0,cos(angle))+.12*seam_line)
            def leg_weights(y):
                if y > -.12:
                    return weighted('Thigh'+suffix,'Pelvis',y,-.118,.065)
                return weighted('Knee'+suffix,'Thigh'+suffix,y,-knee-.093,-knee+.105)
            shell(woven,leg,(side*.111,h,0),denim,leg_weights,rings=17,sides=16,
                  flow=lambda x,y,z,a:(x-side*.031*ease((y+.09)/.16),z+.005*sin(a*2-y*42)*bell((y+knee)/.071)))

            shoe = [(-.083,.069,.129,.045),(-.070,.078,.144,.046),(-.050,.080,.145,.047),
                    (-.025,.077,.133,.046),(.011,.068,.099,.022),(.052,.055,.070,-.009)]
            def shoe_color(y,angle):
                return mix(c['shoe'],c['sole'],1-ease((y+.061)/.014))
            shell(leather,shoe,(side*.111,.084,0),shoe_color,solid('Ankle'+suffix),rings=11,sides=20,
                  flow=lambda x,y,z,a:(x*(.87+.13*cos(a)),z))
            for y,z,width in [(.124,.111,.041),(.112,.137,.039)]:
                seam(leather,[(side*.111-width,y-.001,z),(side*.111,y+.005,z+.003),
                              (side*.111+width,y-.001,z-.004)],.004,.003,c['sole'],'Ankle'+suffix,count=7,sides=5)

    def build(self):
        rig = self.rig()
        skin = Surface('Skin and lips', material('Skin pigment', .67))
        eyes = Surface('Eyes and lids', material('Eyes', .38))
        hair = Surface('Sculpted hair', material('Hair pigment', .53))
        woven = Surface('Tailored layers', material('Cloth pigment', .91))
        leather = Surface('Shoes and trim', material('Waxed leather', .61))
        self.face(skin,eyes)
        self.hair(hair)
        self.garments(woven,skin,leather)
        for surface in (skin,eyes,hair,woven,leather):
            surface.build(rig)
        return rig
