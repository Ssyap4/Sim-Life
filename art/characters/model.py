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
        thickness = taper + (1-taper) * max(0,sin(pi*i/(count-1))) ** .56
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
        self.eye_x = .063 if self.woman else .060
        self.head_sections = (
            [(-.226,.015,.025,.048),(-.207,.053,.061,.047),(-.182,.086,.082,.038),
             (-.143,.109,.101,.025),(-.096,.128,.119,.011),(-.047,.145,.127,.008),
             (.006,.145,.137,-.003),(.061,.139,.137,-.010),(.114,.135,.130,-.013),
             (.160,.113,.115,-.021),(.196,.076,.078,-.031),(.225,.024,.034,-.036),(.234,.003,.004,-.038)]
            if self.woman else
            [(-.230,.015,.028,.047),(-.210,.065,.065,.046),(-.187,.091,.084,.031),
             (-.150,.110,.104,.017),(-.099,.125,.115,.005),(-.050,.138,.123,.003),
             (.006,.142,.132,-.003),(.061,.140,.139,-.009),(.110,.137,.130,-.014),
             (.156,.116,.111,-.019),(.193,.078,.082,-.030),(.222,.024,.033,-.035),(.232,.003,.004,-.038)]
        )

        colors = (
            dict(skin='e4b39e', lip='b26768', hair='635044', hair_light='ba9f75', brow='6c4d3f',
                 shirt='eee7df', jacket='526d92', hem='3f5575', denim='444754', sole='c4ac98', shoe='86766d',
                 iris='658495')
            if self.woman else
            dict(skin='d4a386', lip='9b5f59', hair='2d241f', hair_light='634836', brow='50362b',
                 shirt='efeadc', jacket='486572', hem='344d58', denim='42535e', sole='c3ab91', shoe='78675e',
                 iris='77634a')
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
        eye_y = self.eye_y - self.head_y
        tip_y = -.055 if w else -.067
        mouth_y = -.130 if w else -.136
        mouth_half = .047

        def face_relief(x, y, a):
            side = abs(x)
            bridge_width = .019 + .005 * ease((y-tip_y)/.088)
            root = bell((y-.034)/.035)*bell(x/.042)
            bridge = bell((y-tip_y-.034)/.050)*bell(x/bridge_width)
            tip = bell((y-tip_y)/.018)*bell((x+.0015)/(.018 if w else .021))
            wing = bell((y-tip_y+.010)/.012)*bell((side-.020)/.012)
            nostril = bell((y-tip_y+.016)/.0058)*bell((side-.016)/.0067)
            socket = bell((y-eye_y)/.022)*bell((side-self.eye_x)/.029)
            brow = bell((y-eye_y-.034)/.021)*bell((side-.064)/.057)
            cheekbone = bell((y+.027)/.041)*bell((side-.105)/.036)
            lower_cheek = bell((y+.105)/.043)*bell((side-.103)/.035)
            muzzle = bell((y-mouth_y)/.047)*bell(x/.072)
            chin = bell((y+.186)/.031)*bell(x/(.052 if w else .055))
            philtrum = bell((y-mouth_y-.022)/.014)*(
                bell((side-.009)/.006) - .7*bell(x/.008))
            under_lip = bell((y-mouth_y+.021)/.009)*bell(x/.036)
            return max(0,cos(a)) * (
                .009*root + (.032 if w else .037)*bridge + (.032 if w else .036)*tip
                + .017*wing - .015*nostril - .021*socket + (.008 if w else .013)*brow
                + (.013 if w else .016)*cheekbone - (.001 if w else .012)*lower_cheek
                + .013*muzzle + .013*chin + .004*philtrum - .004*under_lip)

        def front(x, y):
            rx, rz, center = section_at(self.head_sections, y)
            ratio = max(-.999, min(.999, x/rx))
            a = atan2(ratio, sqrt(1-ratio*ratio))
            return center + cos(a)*rz + face_relief(x,y,a) + .030

        warm = srgb('bc7772' if w else 'ab7868')
        cool = srgb('caaa9f' if w else 'ac9184')
        recess = srgb('623d3b' if w else '61453a')
        lip_highlight = srgb('ebbeaa')

        def skin_color(x, y, facing):
            side = abs(x)
            cheek = bell((side-.104)/.044)*bell((y+.063)/.035)
            nose = bell(x/.031)*bell((y-tip_y)/.023)
            lid = bell((side-self.eye_x)/.031)*bell((y-eye_y)/.023)
            nostril = bell((side-.016)/.0069)*bell((y-tip_y+.017)/.005)
            jaw = bell((y+.164)/.039)*bell((side-.094)/.035)
            base = mix(c['skin'],warm,facing*((.30 if w else .18)*cheek+.17*nose+.19*lid))
            base = mix(base,cool,.28*jaw + .17*(1-facing))
            return mix(base,recess,facing*.72*nostril)

        def smile(x, y, z):
            local = y-self.head_y
            if abs(x) > .126 or not -.205 < local < -.050 or z < .085:
                return x,y,z
            lips = bell((local-mouth_y)/.021)*bell(x/.056)
            corner = bell((abs(x)-.038)/.018)
            cheek = bell((abs(x)-.086)/.041)*bell((local+.074)/.052)
            return x*(1+.085*lips), y+.011*lips*corner+.004*cheek, z+.0035*cheek

        def mouth(x, y, v):
            a = x/mouth_half
            fullness = max(0,1-a*a)**.61
            bow = .0027*bell((abs(a)-.30)/.21) - .0015*bell(a/.22)
            line = mouth_y + .0044*min(a*a,1) + (.0013 if w else -.0006)*a
            thickness = (.0105 if w else .0085) if v < .5 else (.0083 if w else .0060)+bow
            t = 2*v-1
            lip_y = line + t*thickness*(.22+.78*fullness)
            y += (lip_y-y)*(1-ease((abs(a)-.88)/.37))
            edge = max(0,sin(pi*v))**.68 * fullness**.55
            closure = bell((v-.50)/.084)
            color = mix(skin_color(x,y,1),c['lip'],edge*(.82 if w else .59))
            color = mix(color,recess,.44*edge*closure)
            color = mix(color,lip_highlight,.14*bell((v-.26)/.15)*edge)
            relief = edge*((.0065 if w else .0047)-.005*closure)
            return y, relief, color

        # Allocate the rings to the features visible head-on. The covered
        # back, lower jaw and top of the skull need fewer samples.
        lip_rings = {mouth_y+.013*(2*v-1):v for v in (0,.17,.32,.43,.50,.57,.70,.85,1)}
        levels = sorted(set((
            self.head_sections[0][0], -.210, -.196, -.188, -.176, -.167, -.158,
            mouth_y-.017, *lip_rings, mouth_y+.017, -.106, -.098, -.091,
            tip_y-.024, tip_y-.019, tip_y-.015, tip_y-.010, tip_y-.005, tip_y,
            tip_y+.008, tip_y+.017, -.029, -.016, -.005, eye_y-.010,
            eye_y, eye_y+.011, eye_y+.023, eye_y+.035, eye_y+.049,
            .084, .102, .125, .148, .173, .197, .214, self.head_sections[-1][0])))
        angles = [-1.29 + 2.58*t for t in samples(41)]
        angles += [1.29 + (2*pi-2.58)*i/15 for i in range(1,15)]
        rows = []
        for y in levels:
            rx, rz, center = section_at(self.head_sections, y)
            row = []
            for a in angles:
                x = sin(a)*rx
                local_y, relief = y, 0
                if y in lip_rings and cos(a) > 0 and abs(x) < mouth_half*1.25:
                    local_y, relief, pigment = mouth(x,y,lip_rings[y])
                    z = front(x,local_y)+relief
                else:
                    z = center + cos(a)*rz + face_relief(x,y,a) + .030
                    pigment = skin_color(x,y,max(0,cos(a)))
                row.append(((x,self.head_y+local_y,z),pigment,{'Head':1}))
            rows.append(row)
        start = len(skin.points)
        skin.patch(rows,closed=True,caps=True)
        skin.morph('Smile',start,smile)

        for side, suffix in [(-1,'L'),(1,'R')]:
            def ear(x,y,z,a):
                rim = .006*bell((y-.019)/.031)
                concha = .008*bell((y+.001)/.019)*bell(x/.018)
                return x+side*y*.26, z + max(0,cos(a))*(rim-concha)
            ear_y = self.head_y - (.049 if w else .060)
            shell(skin,[(-.044,.004,.007,0),(-.029,.018,.011,-.002),(.008,.022,.017,0),
                        (.036,.012,.012,-.004),(.043,.003,.004,-.005)],
                  (side*(.135 if w else .140),ear_y,.015),
                  lambda y,a:mix(c['skin'],warm,.56*max(0,cos(a))*bell(y/.030)),
                  solid('Head'),rings=12,sides=14,flow=ear)
            self.eye(skin,eyes,side,suffix,front,skin_color)
            cx = side*self.eye_x
            brow = []
            for dx,dy in [(-.034,.033),(-.022,.037),(-.004,.039),
                          (.013,.040 if w else .039),(.027,.036),(.039,.029)]:
                x,y = cx+side*dx,eye_y+dy
                brow.append((x,self.head_y+y,front(x,y)+.0015))
            seam(skin,brow,.0034 if w else .0041,.0015,c['brow'],
                 'Head',count=14,sides=5,taper=.10)

    def eye(self, skin, eyes, side, suffix, front, skin_color):
        w = self.woman
        c = self.c
        half = .035 if w else .033
        cx = side*self.eye_x
        cy = self.eye_y-self.head_y
        depth = front(cx,cy)+.0092
        radius = .052
        eye_bone = 'Eye'+suffix
        upper_line = srgb('48312e' if w else '664539')
        lower_line = srgb('a46b63' if w else '9c6559')
        white, tear, pupil = map(srgb,('e4dbd0','b0867d','1b1a19'))

        def globe(x,y):
            return depth-radius+sqrt(max(.0001,radius**2-(x-cx)**2-(y-cy)**2)) - side*(x-cx)*.29

        def margins(a):
            outer = side*a
            contour = max(0,1-a*a)**.68
            line = cy+outer*(.0047 if w else .0027)
            top = (.0126 if w else .0110)*(1-.14*outer)
            bottom = (.0089 if w else .0068)*(1+.13*outer)
            return line-bottom*contour, line+top*contour

        def point(x,y,offset=0):
            return x,self.head_y+y,globe(x,y)+offset

        white_patch = []
        for v in samples(6):
            row = []
            for u in samples(25):
                a = 2*u-1
                low, high = margins(a)
                x, y = cx+a*half, low + (high-low)*v
                color = mix(white,tear,.18*max(0,-side*a)**4+.27*max(0,2*v-1)**2)
                row.append((point(x,y),color,{'Head':1}))
            white_patch.append(row)
        eyes.patch(white_patch)

        rings = []
        for fraction in (.015,.35,.43,.60,.81,.94,1):
            row = []
            for index in range(21):
                theta = 2*pi*index/21
                size = .0130 if w else .0118
                x = cx + cos(theta)*fraction*size
                y = cy + .001 - sin(theta)*fraction*size
                low, high = margins((x-cx)/half)
                y = max(low-.00012,min(high+.00012,y))
                pigment = mix(c['iris'],srgb('b99e70' if w else '9d9569'),
                              .11+.22*max(0,-sin(theta))+.09*cos(theta*7)**2)
                if fraction >= .94:
                    pigment = mix(pigment,pupil,.49 if fraction == 1 else .35)
                if fraction < .43:
                    pigment = pupil
                row.append((point(x,y,.00115),pigment,{eye_bone:1}))
            rings.append(row)
        eyes.patch(rings,closed=True)
        # A tiny, muted catchlight remains legible without changing scene lights.
        eyes.patch([[(point(cx+dx,cy+dy,.00205),srgb('eee6d7'),{eye_bone:1})
                    for dx in (-.0049,-.0027)] for dy in (.0037,.0054)])

        for upper in (False,True):
            base = []
            closed = []
            direction = 1 if upper else -1
            for t in (0,.16,.34,.61,1):
                actual, target = [], []
                for u in samples(25):
                    a = 2*u-1
                    contour = max(0,1-a*a)**.77
                    x = cx+a*(half+.007*t)
                    low,high = margins(a)
                    rim = high if upper else low
                    edge = rim+direction*t*(.008+(.017 if upper else .013)*contour)
                    meet = (low+high)*.5-.0058*contour
                    displacement = (meet-rim-.0004*direction)*(1-ease(t))
                    def lid_point(y, closing=False):
                        outside = max(y-high,low-y,0)
                        feather = max(ease(outside/(.014 if upper else .012)),
                                      ease((abs(x-cx)/half-.89)/.33))
                        depth = globe(x,y)+(.0046 if closing else .0023)
                        z = depth + (front(x,y)-.0014-depth)*feather
                        return x,self.head_y+y,z
                    line_strength = (.93 if w else .71) if upper else .31
                    line_width = .58 if upper else .34
                    color = mix(skin_color(x,edge,1), upper_line if upper else lower_line,
                                line_strength*(1-ease(t/line_width))*contour)
                    actual.append((lid_point(edge),color,{'Head':1}))
                    target.append(lid_point(edge+displacement,closing=True))
                if not upper:
                    actual.reverse()
                    target.reverse()
                base.append(actual)
                closed.extend(target)
            start = len(skin.points)
            skin.patch(base)
            skin.morphs.setdefault('CloseLids',{}).update(
                {start+index:xyz(p) for index,p in enumerate(closed)})

    def hair(self, surface):
        if self.woman:
            self.parted_hair(surface)
        else:
            self.swept_hair(surface)

    def swept_hair(self, surface):
        c = self.c
        rows = []
        for t in samples(25):
            row = []
            for i in range(48):
                a = 2*pi*i/48
                direction = cos(a)
                front = max(0,direction)**.76
                nape = max(0,-direction)**1.15
                side = sin(a)
                # High temples lead into the fade above the ear. The cap
                # is built over the same head sections as the skin.
                hairline = .025 + .110*front - .100*nape
                hairline += front*(.012*sin(a+1.10)+.006*cos(3*a-.5))
                y = hairline+(self.head_sections[-1][0]-hairline)*t
                rx,rz,center = section_at(self.head_sections,y)
                volume = sin(pi*t)**.82
                sweep = a*9.0 + t*7.3 + .44*sin(a*2-t*2.2)
                strand = .5+.5*cos(sweep)
                texture = (.5+.5*cos(2*sweep+.55))**2
                crown = .0031 + volume*(.008+.012*front+.0025*strand**2)
                crest = .027*front*volume*(.80+.30*side)
                x = side*(rx+crown)+ .013*volume*front
                z = center+.030+direction*(rz+crown)+.19*crest
                fade = (1-.96*front)*bell(t/.24)
                color = mix(c['hair'],c['hair_light'],.12+.26*strand**2+.09*texture+.10*fade)
                color = mix(color,c['skin'],.36*fade)
                row.append(((x,self.head_y+y+.008*t+crest,z),color,{'Head':1}))
            rows.append(row)
        surface.patch(rows,closed=True)
        surface.faces.append(tuple(range(len(surface.points)-len(rows[-1]),len(surface.points))))

    def parted_hair(self, surface):
        c = self.c
        drape = [
            (-.405,.164,.106,.013),(-.352,.176,.126,.011),(-.268,.179,.143,.002),
            (-.186,.177,.143,-.001),(-.092,.169,.150,-.003),(.003,.160,.154,.003),
        ]
        hairline = [
            (-.43,1.14),(.03,1.03),(.075,.88),(.110,.65),(.140,.37),
            (.159,.21),(.178,.081),(.195,.011),(.216,.008),(.259,.008),
        ]
        crown = [(.175,.107,.115,.006),(.195,.093,.107,.001),(.216,.075,.092,-.003),
                 (.237,.056,.068,-.006),(.248,.037,.048,-.009),(.255,.023,.031,-.011),
                 (.259,.003,.004,-.012)]
        heights = [i*.60/37 for i in range(38)] + [.614,.627,.638,.647,.654,.659,.662,.664]
        rows = []
        for height in heights:
            t = height/.664
            row = []
            for u in samples(48):
                hem = (1-ease(t/.24))*(.017*cos(3*pi*u+.7)+.010*cos(9*pi*u+1.15))
                y = -.405+height+hem
                gap, = section_at(hairline,y)
                gap += .06*bell((y+.07)/.15)
                side_part = .12 + .11*bell((y-.147)/.083)
                a = gap+(2*pi-2*gap)*u+side_part
                if y > .003:
                    h = min(y,self.head_sections[-1][0])
                    rx,rz,center = section_at(self.head_sections,h)
                    thickness = .010 + .014*bell((y-.098)/.115)
                    rx,rz,center = rx+thickness,rz+thickness,center+.030
                    blend = ease((y-.003)/.072)
                    rx,rz,center = mix(drape[-1][1:],(rx,rz,center),blend)
                    rx,rz,center = mix((rx,rz,center),section_at(crown,y),ease((y-.170)/.040))
                else:
                    rx,rz,center = section_at(drape,y)
                flow = 2*pi*u*7 + 1.0*sin(7.5*t+3.1*u)+.44*cos(11*t-14*u)
                strand = (.5+.5*cos(flow))**1.45
                texture = (.5+.5*cos(2*flow+.75))**2
                waves = sin(pi*t)**.54*(.007+.004*bell((y+.148)/.20))
                groove = bell(min(u,1-u)/.035)*bell((y-.190)/.034)
                ridge = waves*(strand-.38)-.003*groove
                framing = bell(min(u,1-u)/.075)
                swing = .012*sin(y*11.8+u*3.6)+.006*cos(u*17+t*3.2)
                x = sin(a)*(rx+ridge) + swing*(1-ease((t-.84)/.17))
                z = center+cos(a)*(rz+ridge)+framing*.014*bell((y+.042)/.17)
                root = ease((y-.080)/.14)
                tip = 1-ease((y+.37)/.49)
                tint = mix(c['hair'],c['hair_light'],.21+.26*strand+.085*texture+.31*tip-.13*root-.09*groove)
                bind = weighted('Hair','Head',y,-.131,.086)
                row.append(((x,self.head_y+y,z),tint,bind))
            rows.append(row)
        first = len(surface.points)
        surface.patch(rows)
        width = len(rows[0])
        for i in range(len(rows)-1):
            if rows[i][0][0][1]-self.head_y >= .193:
                start = first + width*i
                surface.faces.append((start+width-1,start,start+width,start+2*width-1))
        surface.faces.append(tuple(range(first+width*(len(rows)-1),first+width*len(rows))))
        # Give the visible face-framing edges rounded thickness without
        # stacking free-floating locks in front of the cheeks.
        for side, edge in ((1,0),(-1,-1)):
            edge_rows = []
            for height,row in zip(heights,rows):
                p, tint, bind = row[edge]
                x,y,z = p
                amt = .65*(1-ease((height/.664-.81)/.14))
                vertices = [((x,y,z),tint,bind),
                            ((x-side*.008*amt,y-.004*amt,z-.013*amt),tint,bind),
                            ((x-side*.011*amt,y-.009*amt,z-.024*amt),
                             mix(tint,c['hair'],.40),bind)]
                edge_rows.append(vertices if side == 1 else list(reversed(vertices)))
            surface.patch(edge_rows)

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
        rib = [(sin(a)*.077,self.neck-.005-.007*cos(a),cos(a)*.069-.008)
               for a in (-.92,-.58,0,.58,.92)]
        seam(woven,rib,.005,.003,mix(c['shirt'],srgb('b2a294'),.22),
             'Chest',count=12,sides=6)

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

        shell(woven,jacket,(0,0,0),coat_color,solid('Chest'),rings=17,sides=27,flow=coat_flow,opening=gap)
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
            if w:
                hoop = [(side*(.143+.002*cos(a)),self.head_y-.087+.011*cos(a),.025+.009*sin(a))
                        for a in (0,pi/3,2*pi/3,pi,4*pi/3,5*pi/3,2*pi)]
                seam(leather,hoop,.002,.002,srgb('b99155'),'Head',count=13,sides=5,taper=1)
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
            shell(woven,sleeve,(side*self.arm_x,s,0),cuff,sleeve_weights,rings=13,sides=14,
                  flow=lambda x,y,z,angle:(x-side*.028*ease((y+.015)/.098),
                       z+.004*cos(31*y+angle*2)*bell((y+a)/.15)))
            wrist = (side*self.arm_x,s-a-f,0)
            shell(skin,[(-.096,.023,.013,.010),(-.076,.031,.019,.009),(-.040,.035,.023,.001),
                        (-.014,.030,.022,-.002),(.037,.031,.027,0)],wrist,uniform(c['skin']),
                  solid('Wrist'+suffix),rings=10,sides=13)
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
            shell(woven,leg,(side*.111,h,0),denim,leg_weights,rings=13,sides=14,
                  flow=lambda x,y,z,a:(x-side*.031*ease((y+.09)/.16),z+.005*sin(a*2-y*42)*bell((y+knee)/.071)))

            shoe = [(-.083,.069,.129,.045),(-.070,.078,.144,.046),(-.050,.080,.145,.047),
                    (-.025,.077,.133,.046),(.011,.068,.099,.022),(.052,.055,.070,-.009)]
            def shoe_color(y,angle):
                return mix(c['shoe'],c['sole'],1-ease((y+.061)/.014))
            shell(leather,shoe,(side*.111,.084,0),shoe_color,solid('Ankle'+suffix),rings=8,sides=16,
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
