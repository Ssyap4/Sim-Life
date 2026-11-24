"""Run from the worktree: blender -b -P art/environment/build_botanicals.py.
Model in Blender Z-up. Export only indexed positions and baked pigment to
the game's opaque sector batch, which already owns placement and materials.
"""
import bpy
import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
assets = {}


def export(name, vertices, faces, shade):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    mesh.calc_loop_triangles()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    paint = mesh.color_attributes.new(name="Leaf light", type="FLOAT_COLOR", domain="POINT")
    for item, value in zip(paint.data, shade):
        item.color = (value, value, value, 1)
    assets[name] = {
        "position": [round(axis * 1000) for v in mesh.vertices for axis in (v.co.x, v.co.z, -v.co.y)],
        "index": [i for tri in mesh.loop_triangles for i in tri.vertices],
        "pigment": [round(item.color[0] * 100) for item in paint.data],
    }


def crown(name, lobes, pine=False):
    rng = random.Random(71 + lobes)
    verts, faces, light = [], [], []
    # A closed, scalloped skirt with alternating drooping tips. Splitting
    # the upper and lower rims creates readable overlapping foliage shelves.
    n = lobes * 2
    rings = [(.26, -.64), (.87, -.31), (1.0, .02), (.71, .53), (.30, .87)]
    if pine:
        rings = [(.16, -.61), (1.0, -.39), (.79, -.04), (.42, .50), (.12, .92)]
    for level, (radius, height) in enumerate(rings):
        for i in range(n):
            angle = math.tau * i / n + level * .065
            tip = i % 2 == 0
            tooth = (.30 if pine else .19) if level in (1, 2) else .09
            r = radius * (1 + (tooth if tip else -tooth) + rng.uniform(-.09, .09))
            z = height - (.33 if pine else .19) * (tip and level in (1, 2)) + rng.uniform(-.08, .08)
            verts.append((math.cos(angle)*r + height*.11, math.sin(angle)*r*.94, z))
            light.append([.44,.59,.82,.96,1.06][level] + rng.uniform(-.08,.08))
            if level:
                a = (level-1)*n+i
                b = (level-1)*n+(i+1)%n
                faces.append((a,b,b+n,a+n))
    faces.extend((tuple(reversed(range(n))), tuple(range(4*n,5*n))))
    export(name, verts, faces, light)


def spray():
    vertices, faces, values = [], [], []
    # A terminal leaf and two outward-folding pairs, each with a raised vein.
    for start, angle, length, width in [(.12,-.96,.64,.24),(.22,.98,.62,.25),
                                         (.46,-.72,.62,.22),(.53,.69,.56,.21),(.71,.04,.53,.20)]:
        dx,dy = math.sin(angle),-math.cos(angle)
        base=len(vertices)
        for t,side,z,shade in [(0,0,0,.62),(.45,-1,.06,.80),(.49,0,.16,1.02),
                               (.50,1,.08,.90),(1,0,-.08,.99)]:
            vertices.append((dx*t*length-dy*width*side,-start+dy*t*length+dx*width*side,z-.20*start))
            values.append(shade)
        for face in [(0,1,2),(0,2,3),(1,4,2),(2,4,3)]:
            faces.append(tuple(base+i for i in face))
    export("spray",vertices,faces,values)


def blossom():
    # Stamens are painted at placement. One star-shaped corolla replaces
    # six intersecting ellipsoids, opening up the silhouette between petals.
    vertices, faces, light = [(0,0,-.30)], [], [.65]
    for j in range(7):
        a = j*math.tau/7
        base = len(vertices)
        for delta, radius, z, value in [(-.43,.43,0,.78),(-.27,.93,.38,.94),
                                         (0,1,.27,1.12),(.27,.93,.38,.98),(.43,.43,0,.78),
                                         (0,.57,.06,.87)]:
            vertices.append((math.cos(a+delta)*radius,math.sin(a+delta)*radius,z))
            light.append(value)
        for i,k in [(0,1),(1,2),(2,3),(3,4)]:
            faces.append((base+i,base+k,base+5))
        faces.extend([(0,base,base+5),(0,base+5,base+4)])
    export("corolla",vertices,faces,light)


def grass():
    rng = random.Random(192)
    vertices, faces, light = [], [], []
    for i in range(8):
        a = i*2.4
        dx,dy = math.cos(a),math.sin(a)
        w,h = rng.uniform(.011,.022),rng.uniform(.13,.34)
        drift = rng.uniform(.07,.16)
        base = len(vertices)
        for t, side, shade in [(0,-1,.48),(0,1,.59),(.57,-.77,.76),(.57,0,.93),(.57,.77,.80),(1,0,1.08)]:
            r = .023 + drift*t*t + (.009 if side==0 else 0)
            vertices.append((dx*r-dy*side*w,dy*r+dx*side*w,h*t))
            light.append(shade)
        faces.extend(tuple(base+j for j in f) for f in [(0,1,3),(0,3,2),(3,1,4),(2,3,5),(3,4,5)])
    export("sedge",vertices,faces,light)


bpy.ops.wm.read_factory_settings(use_empty=True)
crown("broadleaf", 5)
crown("birch", 4)
crown("spruce", 7, pine=True)
blossom()
spray()
grass()
output = ROOT / "src/assets/environment/botanicals.json"
output.write_text(json.dumps(assets,separators=(",",":"))+"\n")
