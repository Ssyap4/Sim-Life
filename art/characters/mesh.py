"""Bind-pose mesh construction in the game's right-handed, Y-up space."""

from math import cos, exp, pi, sin

import bpy
from mathutils import Vector


def xyz(p):
    x, y, z = p
    return x, -z, y


def rgb(hex_value):
    return tuple(c/255 for c in bytes.fromhex(hex_value))


def linear(color):
    return tuple(c/12.92 if c < .04045 else ((c+.055)/1.055)**2.4 for c in color)


def blend(a, b, t):
    return tuple(x+(y-x)*t for x, y in zip(a, b))


def bell(x):
    return exp(-x*x)


def smooth(t):
    t = max(0, min(1, t))
    return t*t*(3-2*t)


def ramp(a, b, x):
    return smooth((x-a)/(b-a))


def steps(n):
    return [i/(n-1) for i in range(n)]


def spline(a, b, m, n, t):
    return a+(m+(3*(b-a)-2*m-n+(2*(a-b)+m+n)*t)*t)*t


def profile(sections, y):
    i = next((i for i in range(len(sections)-1) if y <= sections[i+1][0]), len(sections)-2)
    a, b = sections[i:i+2]
    low, high = sections[max(0,i-1)], sections[min(len(sections)-1,i+2)]
    d = b[0]-a[0]
    t = max(0,min(1,(y-a[0])/d))
    return tuple(spline(p,q,(q-l)*d/(b[0]-low[0]),(h-p)*d/(high[0]-a[0]),t)
                 for p,q,l,h in zip(a[1:],b[1:],low[1:],high[1:]))


def solid(bone):
    return {bone:1}


def skin(bottom, top, t):
    t = smooth(t)
    return {bottom:1-t, top:t}


class Mesh:
    def __init__(self, name, material, roughness, image=None):
        self.name = name
        self.material = material
        self.roughness = roughness
        self.image = image
        self.points, self.uvs, self.colors, self.weights, self.faces = [], [], [], [], []
        self.keys = {}

    def grid(self, rows, closed=False, caps=False, flip=False):
        start = len(self.points)
        stride = len(rows[0])
        for row in rows:
            for p,c,w,uv in row:
                self.points.append(p)
                self.colors.append((*linear(c),1))
                self.weights.append(w)
                self.uvs.append(uv)
        for r in range(len(rows)-1):
            for j in range(stride if closed else stride-1):
                a = start+r*stride+j
                b = start+r*stride+(j+1)%stride
                quad = (a,b,b+stride,a+stride)
                self.faces.append(quad[::-1] if flip else quad)
        if caps:
            self.faces.append(tuple(start+j for j in reversed(range(stride))))
            end = start+stride*(len(rows)-1)
            self.faces.append(tuple(end+j for j in range(stride)))
        return start

    def deformation(self, name, start, points):
        self.keys.setdefault(name,{}).update({start+i:p for i,p in enumerate(points)})

    def lathe(self, sections, origin, paint, bind, rings=14, sides=20, warp=None):
        rows = []
        for t in steps(rings):
            y = sections[0][0]+(sections[-1][0]-sections[0][0])*t
            rx,rz,z0 = profile(sections,y)
            row = []
            for j in range(sides):
                a = j*2*pi/sides
                pos = (sin(a)*rx, y, z0+cos(a)*rz)
                if warp:
                    pos = warp(*pos,a,t)
                pos = tuple(p+o for p,o in zip(pos,origin))
                row.append((pos,paint(t,a),bind(t),(0,0)))
            rows.append(row)
        return self.grid(rows,closed=True,caps=True)

    def cord(self, path, color, weight, sides=5, thickness=1):
        rows = []
        for i,(p,r) in enumerate(path):
            p = Vector(p)
            tangent = (Vector(path[min(i+1,len(path)-1)][0])-Vector(path[max(0,i-1)][0])).normalized()
            guide = Vector((0,0,1)) if abs(tangent.z) < .94 else Vector((0,1,0))
            across = tangent.cross(guide).normalized()
            depth = tangent.cross(across).normalized()
            rows.append([(p+r*(across*cos(2*pi*j/sides)+depth*thickness*sin(2*pi*j/sides)),
                          color, weight,(0,0)) for j in range(sides)])
        return self.grid(rows,closed=True,caps=True)

    def build(self, rig):
        data = bpy.data.meshes.new(self.name)
        data.from_pydata([xyz(p) for p in self.points], [], self.faces)
        data.update()
        obj = bpy.data.objects.new(self.name, data)
        bpy.context.collection.objects.link(obj)
        obj.parent = rig
        material = bpy.data.materials.new(self.material)
        material.use_nodes = True
        nodes = material.node_tree.nodes
        shader = nodes.get('Principled BSDF')
        shader.inputs['Roughness'].default_value = self.roughness
        if self.image:
            tex = nodes.new('ShaderNodeTexImage')
            tex.image = self.image
            material.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])
            uv = data.uv_layers.new(name='Paint')
            for loop in data.loops:
                uv.uv[loop.index].vector = self.uvs[loop.vertex_index]
        else:
            vertex = nodes.new('ShaderNodeVertexColor')
            vertex.layer_name = 'Pigment'
            material.node_tree.links.new(vertex.outputs['Color'],shader.inputs['Base Color'])
            colors = data.color_attributes.new(name='Pigment',type='FLOAT_COLOR',domain='POINT')
            colors.data.foreach_set('color',[channel for color in self.colors for channel in color])
        data.materials.append(material)
        data.polygons.foreach_set('use_smooth',[True]*len(data.polygons))
        if self.keys:
            obj.shape_key_add(name='Basis')
            for name,points in self.keys.items():
                key = obj.shape_key_add(name=name)
                for i,p in points.items():
                    key.data[i].co = xyz(p)
        for name in sorted({b for weights in self.weights for b in weights}):
            group = obj.vertex_groups.new(name=name)
            for i,weights in enumerate(self.weights):
                if weights.get(name,0) > .0001:
                    group.add([i],weights[name],'REPLACE')
        mod = obj.modifiers.new('Skin','ARMATURE')
        mod.object = rig
        return obj
