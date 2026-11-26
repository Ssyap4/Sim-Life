"""Reference-directed portrait revision; never reads or embeds private photos.
All parameters are hand-authored from the supplied visual references.
Run in cloud Blender 4.3.2 using the existing approved armature exporter.
"""
from pathlib import Path
import sys
ART=Path(__file__).resolve().parent
sys.path.insert(0,str(ART))
from remake import main
if __name__=='__main__':
    main()
