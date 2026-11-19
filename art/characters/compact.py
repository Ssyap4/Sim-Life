"""Pack glTF color and weight streams using core normalized integer accessors."""

import json
import struct


def weight_bytes(row):
    # Preserve the unit sum after quantization, including two-joint blends.
    values = [max(0, weight) for weight in row]
    total = sum(values)
    if not total:
        return bytes((255, 0, 0, 0))
    floats = [weight * 255 / total for weight in values]
    rounded = [int(weight) for weight in floats]
    order = sorted(range(4), key=lambda i: floats[i] - rounded[i], reverse=True)
    for i in order[:255 - sum(rounded)]:
        rounded[i] += 1
    return bytes(rounded)


def color_bytes(row):
    channels = [round(max(0, min(1, value)) * 65535) for value in row]
    # A VEC3 vertex attribute starts on a four-byte boundary in glTF.
    return struct.pack('<4H', *(channels + [0] * (4 - len(channels))))


def align(data, padding=b'\x00'):
    return data + padding * (-len(data) % 4)


def compact(path):
    raw = path.read_bytes()
    magic, version, _ = struct.unpack_from('<4sII', raw)
    json_length, kind = struct.unpack_from('<I4s', raw, 12)
    bin_length, bin_kind = struct.unpack_from('<I4s', raw, 20 + json_length)
    if (magic, version, kind, bin_kind) != (b'glTF', 2, b'JSON', b'BIN\x00'):
        raise ValueError('Expected a binary glTF 2 asset')
    doc = json.loads(raw[20:20 + json_length])
    if len(doc['buffers']) != 1 or 'uri' in doc['buffers'][0]:
        raise ValueError('Expected one embedded glTF buffer')
    source = memoryview(raw)[28 + json_length:28 + json_length + bin_length]
    accessors, views = doc['accessors'], doc['bufferViews']
    references = {}
    for accessor in accessors:
        if 'bufferView' in accessor:
            i = accessor['bufferView']
            references[i] = references.get(i, 0) + 1

    def payload(view):
        start = view.get('byteOffset', 0)
        return bytes(source[start:start + view['byteLength']])

    packed = {}
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            for name, size, component, stride, pack in [
                ('COLOR_0', 3, 5123, 8, color_bytes),
                ('WEIGHTS_0', 4, 5121, 4, weight_bytes),
            ]:
                index = primitive['attributes'].get(name)
                if index is None:
                    continue
                accessor = accessors[index]
                view_id = accessor['bufferView']
                view = views[view_id]
                if (references[view_id] != 1 or accessor['componentType'] != 5126
                        or accessor['type'] != f'VEC{size}' or 'sparse' in accessor
                        or accessor.get('byteOffset', 0) or view.get('byteStride')):
                    continue
                data = payload(view)
                if len(data) != accessor['count'] * size * 4:
                    raise ValueError('Unexpected attribute stream length')
                data = b''.join(pack(row) for row in struct.iter_unpack('<' + 'f' * size, data))
                accessor.update(componentType=component, normalized=True)
                accessor.pop('min', None)
                accessor.pop('max', None)
                view['byteStride'] = stride
                packed[view_id] = data
                if name == 'WEIGHTS_0':
                    joints = accessors[primitive['attributes']['JOINTS_0']]
                    joint_view_id = joints['bufferView']
                    joint_view = views[joint_view_id]
                    unit = {5121: 1, 5123: 2}.get(joints['componentType'])
                    indices = bytearray(payload(joint_view))
                    if (unit is not None and len(indices) == len(data) * unit
                            and references[joint_view_id] == 1 and not joints.get('byteOffset')
                            and not joint_view.get('byteStride')):
                        for i, weight in enumerate(data):
                            if not weight:
                                indices[i * unit:(i + 1) * unit] = bytes(unit)
                        packed[joint_view_id] = indices

    # Blender puts all identity skin nodes below the armature. glTF applies
    # ancestor transforms through the joints, so store the meshes beside it.
    nodes = doc['nodes']
    transform = {'matrix', 'translation', 'rotation', 'scale'}
    for scene in doc['scenes']:
        for index in scene['nodes'][:]:
            armature = nodes[index]
            if 'character' not in armature.get('extras', {}) or transform.intersection(armature):
                continue
            meshes = [child for child in armature.get('children', [])
                      if 'skin' in nodes[child] and not transform.intersection(nodes[child])]
            scene['nodes'].extend(meshes)
            armature['children'] = [child for child in armature['children'] if child not in meshes]

    buffer = bytearray()
    for index, view in enumerate(views):
        data = packed[index] if index in packed else payload(view)
        view['byteOffset'] = len(buffer)
        view['byteLength'] = len(data)
        buffer.extend(align(data))
    doc['buffers'][0]['byteLength'] = len(buffer)
    header = align(json.dumps(doc, separators=(',', ':'), ensure_ascii=True).encode(), b' ')
    body = struct.pack('<I4s', len(header), b'JSON') + header + struct.pack('<I4s', len(buffer), b'BIN\x00') + buffer
    path.write_bytes(struct.pack('<4sII', b'glTF', 2, 12 + len(body)) + body)
