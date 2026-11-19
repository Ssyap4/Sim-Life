"""Build the editable bind pose and the facial animation, then export both files."""

import argparse
import sys
from pathlib import Path

import bpy
from mathutils import Quaternion

SOURCE_DIR = Path(__file__).resolve().parent
sys.dont_write_bytecode = True
sys.path.insert(0, str(SOURCE_DIR))

from export import export
from model import Resident


def blink(rig, resident):
    scene = bpy.context.scene
    scene.render.fps = 30
    scene.frame_start = 1
    scene.frame_end = 181
    rig.animation_data_create()
    action = bpy.data.actions.new('Blink')
    rig.animation_data.action = action
    first = 32 if resident.woman else 79
    for suffix, delay in [('L', 0), ('R', 1)]:
        eye = rig.pose.bones['Eye' + suffix]
        timing = [(1, 1), (first + delay, 1), (first + 2 + delay, .075),
                  (first + 4 + delay, .24), (first + 6 + delay, 1), (181, 1)]
        for frame, height in timing:
            eye.scale = (1, height, 1)
            eye.keyframe_insert(data_path='scale', frame=frame, group=eye.name)
    scene.frame_set(1)


def save_sources(resident, source_dir):
    bpy.context.preferences.filepaths.save_version = 0
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                view = area.spaces.active
                view.region_3d.view_location = (0, 0, 1)
                view.region_3d.view_distance = 2.9
                view.region_3d.view_rotation = Quaternion((1, 0, 0), 1.39)
                view.shading.color_type = 'VERTEX'
    source_dir.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(source_dir / (resident.name + '.blend')), compress=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('character', choices=('vlad', 'alina'))
    parser.add_argument('--source-dir', type=Path, default=SOURCE_DIR)
    parser.add_argument('--output-dir', type=Path, default=SOURCE_DIR.parent.parent / 'src/assets/characters')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    resident = Resident(args.character)
    rig = resident.build()
    blink(rig, resident)
    save_sources(resident, args.source_dir.resolve())
    export(args.output_dir / (resident.name + '.glb'))


if __name__ == '__main__':
    main()
