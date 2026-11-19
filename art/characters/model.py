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
        self.morphs = {}

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

    def morph(self, name, start, deform):
        coordinates = self.morphs.setdefault(name, {})
        for index in range(start, len(self.points)):
            x, z_blender, y = self.points[index]
            point = (x, y, -z_blender)
            target = deform(*point)
            if target != point:
                coordinates[index] = xyz(target)

    def build(self, rig):
        data = bpy.data.meshes.new(self.name)
        data.from_pydata(self.points, [], self.faces)
        data.update()
        obj = bpy.data.objects.new(self.name, data)
        bpy.context.collection.objects.link(obj)
        obj.parent = rig
        data.materials.append(self.material)
        if self.morphs:
            obj.shape_key_add(name='Basis')
            for name, vertices in self.morphs.items():
                key = obj.shape_key_add(name=name)
                for index, position in vertices.items():
                    key.data[index].co = position
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
        self.eye_y = self.head_y + (.021 if self.woman else .017)
        self.eye_x = .064 if self.woman else .061

        colors = (
            dict(skin='e5b6a5', cheek='ce8c86', lip='aa6664', hair='75533e', hair_light='d9bc8c',
                 shirt='eee4d4', jacket='a76857', hem='78473e', denim='504751', sole='bd9b80', shoe='936d58',
                 iris='6b775c')
            if self.woman else
            dict(skin='cda088', cheek='bd8576', lip='86524c', hair='282523', hair_light='665348',
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
            add('Eye'+suffix, (side*self.eye_x,self.eye_y,.117), 'Head')
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
        w = self.woman
        # Individual jaw/zygoma/temple silhouettes. Depth increases behind the
        # cheeks so the profile has room for the cranium and the jaw hinge.
        profile = [
            (-.218,.028,.039,.043),(-.200,.066,.066,.045),
            (-.173,.100 if w else .107,.080,.034),(-.129,.121 if w else .125,.100,.022),
            (-.080,.140 if w else .135,.116,.012),(-.039,.153 if w else .146,.132,.004),
            (.006,.148 if w else .145,.139,-.002),(.053,.144 if w else .145,.137,-.006),
            (.105,.142,.127,-.008),(.155,.117,.111,-.020),(.199,.066,.072,-.027),(.222,.002,.004,-.031),
        ]
        eye_y = self.eye_y - self.head_y

        def form(x, y, z, a):
            forward = max(0, cos(a))
            side = abs(x)
            root = bell((y-.024)/.033)*bell(x/.027)
            bridge = bell((y+.020)/.057)*bell(x/(.022 if w else .020))
            tip = bell((y+.060)/.015)*bell((x+.001)/.026)
            alar = bell((y+.073)/.013)*bell((side-.022)/.010)
            nostril = bell((y+.079)/.0059)*bell((side-.019)/.0071)
            orbit = bell((y-eye_y)/.025)*bell((side-self.eye_x)/.037)
            brow = bell((y-.058)/.018)*bell((side-.063)/.041)
            cheekbone = bell((y+.027)/.033)*bell((side-.107)/.028)
            lower_cheek = bell((y+.112)/.046)*bell((side-.102)/.032)
            mouth = bell((y+.120)/.036)*bell(x/.062)
            philtrum = bell((y+.097)/.017)*(bell((side-.009)/.007)-.63*bell(x/.007))
            chin = bell((y+.180)/.027)*bell(x/.051)
            return x, z + forward*(.014*root + (.037 if w else .044)*bridge + .021*tip
                + .010*alar - .011*nostril - .020*orbit + (.009 if w else .015)*brow
                + .018*cheekbone - (.004 if w else .012)*lower_cheek + .012*mouth
                + .004*philtrum + .013*chin)

        def front(x, y):
            rx, rz, center = section_at(profile, y)
            ratio = max(-.999, min(.999, x/rx))
            a = atan2(ratio, sqrt(1-ratio*ratio))
            return form(x,y,center+cos(a)*rz,a)[1]+.030

        warm = srgb('b6796e' if w else '9e6f61')
        shadow = srgb('705049')
        cool = srgb('be988f' if w else 'ac887b')

        def skin_color(x, y, facing):
            side = abs(x)
            cheek = bell((side-.103)/.052)*bell((y+.067)/.043)
            nose = bell(x/.029)*bell((y+.060)/.030)
            eyelid = bell((side-self.eye_x)/.040)*bell((y-eye_y)/.026)
            nostril = bell((side-.019)/.007)*bell((y+.080)/.005)
            chin = bell((y+.174)/.045)*bell(x/.091)
            base = mix(c['skin'],warm,facing*(.27*cheek+.15*nose+.22*eyelid))
            base = mix(base,cool,facing*.14*chin + .13*(1-facing))
            return mix(base,shadow,facing*.55*nostril)

        def smile(x, y, z):
            local = y-self.head_y
            if abs(x) > .128 or not -.185 < local < -.038 or z < .080:
                return x,y,z
            lips = bell((local+.126)/.027)*bell(x/.052)
            corner = bell((abs(x)-.032)/.015)
            cheek = bell((abs(x)-.080)/.038)*bell((local+.074)/.051)
            return x*(1+.125*lips), y+.010*lips*corner+.0055*cheek, z+.004*cheek

        skin_start = len(skin.points)
        shell(skin,profile,(0,self.head_y,.030),
              lambda y,a:skin_color(sin(a)*section_at(profile,y)[0],y,max(0,cos(a))),
              solid('Head'),rings=35,sides=40,flow=form)
        skin.morph('Smile',skin_start,smile)

        for side, suffix in [(-1,'L'),(1,'R')]:
            def ear(x,y,z,a):
                return x+side*y*.20, z + cos(a)*(.005*bell((y-.005)/.025)-.008*bell((y+.007)/.017))
            shell(skin,[(-.044,.007,.009,0),(-.028,.021,.012,0),(.012,.026,.017,0),
                        (.038,.013,.010,0),(.044,.004,.004,0)],
                  (side*.145,self.head_y-.045,.007),
                  lambda y,a:mix(c['skin'],warm,.51*max(0,cos(a))*bell(y/.027)),
                  solid('Head'),rings=10,sides=12,flow=ear)
            self.eye(skin,eyes,side,suffix,front,skin_color)
            cx = side*self.eye_x
            brow = []
            for dx,dy in [(-.033,.032),(-.014,.041),(.004,.043 if w else .040),(.024,.036),(.037,.027)]:
                x,y = cx+side*dx,eye_y+dy
                brow.append((x,self.head_y+y,front(x,y)+.0022))
            seam(skin,brow,.0041 if w else .0049,.0017,mix(c['hair'],warm,.52 if w else .25),
                 'Head',count=13,sides=5,taper=.13)

        # Upper bow, lower lip and the commissures share the nasolabial motion.
        start = len(skin.points)
        lips = []
        for v in samples(7):
            row = []
            for u in samples(23):
                a = 2*u-1
                x = (.034 if w else .032)*a
                edge = (1-a*a)**.83
                bow = .0022*bell((abs(a)-.30)/.16) - .0011*bell(a/.17)
                y = -.126+.0040*a*a+(2*v-1)*edge*(.0073 if v < .5 else .0054+bow*190*.0054)
                core = bell((v-.51)/.15)
                lower_light = bell((v-.23)/.17)
                tint = mix(skin_color(x,y,1),c['lip'],edge*(.35+.51*core))
                tint = mix(tint,srgb('e2ae9b'),.16*lower_light*edge)
                z = front(x,y)+.0003+.0037*edge*sin(pi*v)
                row.append(((x,self.head_y+y,z),tint,{'Head':1}))
            lips.append(row)
        skin.patch(lips)
        skin.morph('Smile',start,smile)

    def eye(self, skin, eyes, side, suffix, front, skin_color):
        w = self.woman
        c = self.c
        half = .034 if w else .032
        height = .0135 if w else .0114
        cx = side*self.eye_x
        cy = self.eye_y-self.head_y
        depth = front(cx,cy)+.0085
        radius = .053
        eye_bone = 'Eye'+suffix
        lid_line = srgb('65483f' if w else '715047')
        white, tear, pupil = map(srgb,('e5dcd2','a97570','1a1b19'))

        def globe(x,y):
            return depth-radius+sqrt(max(.0001,radius**2-(x-cx)**2-(y-cy)**2)) - side*(x-cx)*.29

        def margins(a):
            contour = max(0,1-a*a)**.79
            center = cy+side*a*.0028
            return center-height*.68*contour, center+height*contour

        def eye_vertex(a,v,offset=0):
            x = cx+a*half
            lower, upper = margins(a)
            y = lower+(upper-lower)*v
            return x,self.head_y+y,globe(x,y)+offset

        white_patch = []
        for v in samples(7):
            row = []
            for u in samples(23):
                a = 2*u-1
                tint = mix(white,tear,.27*max(0,-side*a)**4+.21*max(0,2*v-1)**2)
                row.append((eye_vertex(a,v),tint,{'Head':1}))
            white_patch.append(row)
        eyes.patch(white_patch)

        rings = []
        for radius_fraction in [.012,.34,.42,.54,.76,.93,1]:
            row = []
            for index in range(19):
                theta = 2*pi*index/19
                a = cos(theta)*radius_fraction*.405
                v = .52-sin(theta)*radius_fraction*.478
                warm = .14+.19*max(0,-sin(theta))+.095*cos(theta*8)**2
                pigment = mix(c['iris'],srgb('c4a575' if w else '9d9881'),warm)
                pigment = mix(pigment,lid_line,.61) if radius_fraction > .92 else pigment
                pigment = pupil if radius_fraction < .42 else pigment
                row.append((eye_vertex(a,v,.0014),pigment,{eye_bone:1}))
            rings.append(row)
        eyes.patch(rings,closed=True)
        # Diffuse window glint plus the material's small specular component.
        eyes.patch([[(eye_vertex(a,v,.0024),srgb('eee6d3'),{eye_bone:1})
                    for a in [-.129,-.054]] for v in [.64,.72]])

        for upper_lid in (False,True):
            base = []
            closed = []
            for t in (0,.23,.49,.74,1):
                actual, target = [], []
                for u in samples(23):
                    a = 2*u-1
                    contour = max(0,1-a*a)**.79
                    direction = 1 if upper_lid else -1
                    x = cx+a*(half+.007*t)
                    y0,y1 = margins(a)
                    rim = y1 if upper_lid else y0
                    edge = rim+direction*t*(.010+.016*contour)
                    meet = cy+side*a*.0028 - .0061*contour
                    displacement = (meet-rim-.00025*direction)*(1-ease(t))
                    def point(y, closing=False):
                        # Keep the lid in front of the globe across the entire
                        # original eye opening. Feather only outside that area.
                        outside = max(y-y1,y0-y,0)
                        side_feather = ease((abs(x-cx)/half-.90)/.32)
                        feather = max(ease(outside/.017),side_feather)
                        socket = globe(x,y)+(.0047 if closing else .0030)
                        z = socket+(front(x,y)-.0018-socket)*feather
                        return x,self.head_y+y,z
                    color = mix(skin_color(x,edge,1),lid_line,
                                (.51 if upper_lid else .27)*(1-ease(t/.38))*contour)
                    actual.append((point(edge),color,{'Head':1}))
                    target.append(point(edge+displacement,closing=True))
                if not upper_lid:
                    actual.reverse()
                    target.reverse()
                base.append(actual)
                closed.extend(target)
            start = len(skin.points)
            skin.patch(base)
            # All lids are sculpted into the same shape key; the iris stays put.
            skin.morphs.setdefault('CloseLids',{}).update(
                {start+index:xyz(point) for index,point in enumerate(closed)})

    def hair(self, surface):
        c = self.c
        w = self.woman
        # Compact sides taper along the temple. A directional flow field goes
        # across the raised part, then merges into the lower nape.
        profile = [
            (-.085,.151,.136,.005),(-.022,.155,.145,.004),(.049,.158,.157,.001),
            (.108,.156,.157,-.003),(.154,.149,.148,-.008),(.192,.125,.125,-.017),
            (.222,.086,.084,-.024),(.248,.040,.052,-.027),(.263,.001,.002,-.034),
        ]
        rows = []
        for t in samples(22):
            row = []
            for i in range(40):
                a = 2*pi*i/40
                swept = sin(a)
                forward = ease((cos(a)+.1)/1.05)
                temple = sin(a)**2
                front = .166 if w else .183
                hairline = -.086 + forward*front + temple*(.074 if w else .087)
                hairline += forward*(.016*cos(a*3+.82)+.013*sin(a*1.3))
                edge = hairline + .0025*sin(a*23)
                height = edge+(.263-edge)*t
                rx,rz,center = section_at(profile,height)
                if w:
                    root = (1-ease((cos(a)+.2)/.50))*(1-ease((height-.074)/.096))
                    rx *= 1-.13*root
                    rz *= 1-.16*root
                flow = a*(12 if w else 11)+t*(5.2 if w else 6.4)+sin(a-t*1.9)*2.21
                fine = .5 + .5*cos(flow)
                volume = sin(pi*t)**1.24
                ridge = (.0056*fine**3-.0018)*volume
                quiff = forward*volume*(.011 if w else .025)*(1+.37*swept)
                x = sin(a)*(rx+ridge)+volume*(.017 if w else .025)
                z = center+cos(a)*(rz+ridge)+quiff*.43
                y = height+quiff
                part = bell((a-(.46 if w else .69))/.094)*bell((t-.49)/.31)
                color = mix(c['hair'],c['hair_light'],.13+(.49 if w else .34)*fine**2
                            +.16*volume+.21*part)
                row.append(((x,self.head_y+y,z),color,{'Head':1}))
            rows.append(row)
        surface.patch(rows,closed=True)

        if not w:
            return

        # One flowing mantle from the part to the nape. Variable contours
        # between its waves create distinct tips while keeping the crown united.
        curtain = [
            (-.420,.143,.079,.002),(-.372,.170,.108,.006),(-.292,.189,.128,.013),
            (-.185,.200,.149,.004),(-.091,.184,.158,-.012),
            (.016,.168,.160,-.014),(.107,.157,.145,-.020),(.181,.119,.107,-.027),
            (.227,.080,.064,-.033),
        ]
        mantle = []
        for t in samples(24):
            row = []
            for u in samples(44):
                neck_fall = 1-ease(t/.26)
                hem = .022*cos(5*pi*u)+.015*cos(17*pi*u+1.1)
                height = -.42+.647*t+neck_fall*hem
                rx,rz,center = section_at(curtain,height)
                opening = .96+.20*sin(pi*t)+.07*sin(17*t)
                angle = opening+(2*pi-2*opening)*u+.075*sin(10*t)
                flow = 2*pi*u*8+.93*sin(12*t+3*u)+.16*sin(29*t)
                wave = (.0064+.007*neck_fall)*cos(flow)
                x = sin(angle)*(rx+wave)+.010*sin(12*t+2*u)
                z = center+cos(angle)*(rz+wave)
                lit = (.5+.5*cos(flow))**1.3
                tint = mix(c['hair'],c['hair_light'],.13+.39*lit+.19*(1-t)+.06*max(0,cos(angle)))
                bind = weighted('Hair','Head',height,.034,.207)
                row.append(((x,self.head_y+height,z),tint,bind))
            mantle.append(row)
        surface.patch(mantle)
        # Narrow, offset face-framing wisps release the ends from the mantle.
        for side in (-1,1):
            for j in range(2):
                path = [
                    (side*(.078+j*.027),self.head_y+.188-j*.014,.091-j*.013),
                    (side*(.127+j*.028),self.head_y+.095,.125-j*.026),
                    (side*(.162+j*.022),self.head_y-.039,.107-j*.028),
                    (side*(.167+j*.024),self.head_y-.149,.145-j*.029),
                    (side*(.179+j*.015),self.head_y-.261,.116-j*.028),
                    (side*(.149+j*.018),self.head_y-.383+j*.029,.079-j*.013),
                ]
                seam(surface,path,.031-j*.008,.010,mix(c['hair'],c['hair_light'],.62-j*.15),
                     'Hair',count=17,sides=7,taper=.10)

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

        neck = [(self.neck-.04,.071,.067,-.014),(self.neck+.052,.063,.060,-.011),
                (self.neck+.126,.070,.063,.013),(self.neck+.166,.077,.070,.030)]
        shell(skin,neck,(0,0,0),uniform(c['skin']),
              lambda y:weighted('Chest','Head',y,self.neck+.040,self.neck+.143),rings=12,sides=18)
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
            shell(woven,sleeve,(side*self.arm_x,s,0),cuff,sleeve_weights,rings=15,sides=15,
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
            shell(woven,leg,(side*.111,h,0),denim,leg_weights,rings=16,sides=15,
                  flow=lambda x,y,z,a:(x-side*.031*ease((y+.09)/.16),z+.005*sin(a*2-y*42)*bell((y+knee)/.071)))

            shoe = [(-.083,.069,.129,.045),(-.070,.078,.144,.046),(-.050,.080,.145,.047),
                    (-.025,.077,.133,.046),(.011,.068,.099,.022),(.052,.055,.070,-.009)]
            def shoe_color(y,angle):
                return mix(c['shoe'],c['sole'],1-ease((y+.061)/.014))
            shell(leather,shoe,(side*.111,.084,0),shoe_color,solid('Ankle'+suffix),rings=10,sides=19,
                  flow=lambda x,y,z,a:(x*(.87+.13*cos(a)),z))
            for y,z,width in [(.124,.111,.041),(.112,.137,.039)]:
                seam(leather,[(side*.111-width,y-.001,z),(side*.111,y+.005,z+.003),
                              (side*.111+width,y-.001,z-.004)],.004,.003,c['sole'],'Ankle'+suffix,count=7,sides=5)

    def build(self):
        rig = self.rig()
        skin = Surface('Face and hands', material('Skin pigment', .79))
        eyes = Surface('Eyes and lids', material('Eyes', .37))
        hair = Surface('Sculpted hair', material('Hair pigment', .66))
        woven = Surface('Tailored layers', material('Cloth pigment', .94))
        leather = Surface('Shoes and trim', material('Waxed leather', .61))
        self.face(skin,eyes)
        self.hair(hair)
        self.garments(woven,skin,leather)
        for surface in (skin,eyes,hair,woven,leather):
            surface.build(rig)
        return rig
