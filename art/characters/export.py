"""Export the opened resident .blend to a local game asset."""

import argparse
import sys
from pathlib import Path

import bpy

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))

from compact import compact


def export(path):
    path = Path(path).resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.frame_set(1)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format='GLB',
        export_animations=True,
        export_animation_mode='ACTIONS',
        export_extras=True,
        export_materials='EXPORT',
        export_all_vertex_colors=False,
        export_skins=True,
        export_morph_normal=False,
        export_draco_mesh_compression_enable=False,
    )
    compact(path)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('output', type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    export(args.output)
