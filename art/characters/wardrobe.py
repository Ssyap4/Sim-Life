"""Small wardrobe prototype; garments replace body surfaces on the resident rig."""
from math import sin, cos, pi
from mesh import Mesh, bell, blend, profile, ramp, rgb, skin, solid, steps

LOOKS = {
    'alina': [
        ('home', 'e6a9a8', 'bf7e82', '67616d', 'shorts', 'fitted'),
        ('denim', 'f4ede1', 'c2b8a7', '557d9c', 'jeans', 'classic'),
        ('city', '536d58', '374e40', 'd2b8a0', 'trousers', 'relaxed'),
        ('cozy', 'c5b4d5', '9b88b0', '66636d', 'joggers', 'hoodie'),
        ('street', 'e2c8a9', 'b59778', '384d66', 'jeans', 'hoodie'),
        ('summer', 'f0e8dc', 'b8aea1', '6485a1', 'denimshorts', 'oversize'),
        ('pink', 'b35672', '8c3752', 'e6d4b8', 'shorts', 'cap'),
        ('sportshort', '8c9dba', 'e1e3e6', '383d49', 'sportshorts', 'zip'),
        ('wide', 'eee1c9', 'b9aa96', '444d5f', 'wide', 'fitted'),
        ('highrise', '3f5d73', 'b5c6ce', '8ea5b9', 'highrise', 'cap'),
        ('lounge', 'b0a9b4', 'e3d8df', 'b0a9b4', 'joggers', 'zip'),
    ],
    'vlad': [
        ('home', '53665d', '35483f', '575b61', 'shorts', 'relaxed'),
        ('denim', 'a74e3c', 'd9c2a0', '273849', 'wide', 'oversize'),
        ('city', '30343b', '161b21', 'b5a28a', 'trousers', 'fitted'),
        ('cozy', '667d91', '43586c', '44494f', 'joggers', 'hoodie'),
        ('street', 'b9b4a9', '918c81', '364c68', 'jeans', 'hoodie'),
        ('track', '202933', 'f3eee5', '202933', 'track', 'track'),
        ('polo', '365d78', 'e0d6bd', 'c9c6b7', 'trousers', 'polo'),
        ('cargo', 'd9c1a1', '474d3b', '525d43', 'cargo', 'oversize'),
        ('graphic', '293b40', 'c7a078', '7996a6', 'jeans', 'graphic'),
        ('athletic', '9a694a', 'e5d7bd', '30383d', 'joggers', 'zip'),
        ('weekend', '7491a4', 'ddd8cd', 'c5b299', 'shorts', 'polo'),
    ],
}


def top_mesh(r, look, top, trim, style):
    m = Mesh(look+' upper', 'Cloth pigment', .91)
    h,s,n = r.hip,r.shoulder,r.neck
    w = r.woman
    hoodie = style in ('hoodie','zip')
    long = hoodie or style in ('track','robe','olympic')
    ease = {'fitted': -.007, 'classic': 0, 'relaxed': .012, 'hoodie': .019, 'oversize': .030, 'cap': -.005, 'zip': .015, 'track': .010, 'polo': .006, 'graphic': .020, 'robe': .028, 'olympic': .014}[style]
    hem = h + (-.19 if style=='robe' else -.018 if style=='oversize' else .006 if long or style=='relaxed' else .025)
    chest = .173 if w else .203
    waist = .143 if w else .166
    shape = [(hem,.199 if w else .207,.126,-.009),
             (h+.065,.177 if w else .190,.115,-.009),
             (h+.157,waist,.099,-.007),(s-.135,chest,.119 if w else .127,.002),
             (s-.045,chest+.010,.108,-.007),(s+.012,.169 if w else .192,.087,-.011),
             (s+.064,.105,.069,-.012),(n,.074,.065,-.014)]
    if style=='robe':
        shape=[(hem,.224,.151,-.009),(h-.075,.221,.142,-.009),(h+.018,.201,.128,-.008)]+shape[1:]
    shape=[(y,x+ease*(1-ramp(s+.005,n,y)),z+ease*.65*(1-ramp(s+.005,n,y)),c) for y,x,z,c in shape]
    def paint(t,a):
        edge = max(1-ramp(.02,.09,t), ramp(.92,.99,t))
        if style=='olympic' and cos(a)>.76 and abs(sin(a))<.36+.18*t:
            return trim
        if style=='graphic' and cos(a)>.87 and .44<t<.72:
            return blend(top,trim,.88 if int(t*34)%3 else .35)
        return blend(top,trim,.45*edge+.12*max(0,-cos(a))+.04*sin(a*13+t*13)**2)
    def warp(x,y,z,a,t):
        f=.006*sin(4*a+19*t)*bell((t-.25)/.17)+.003*sin(7*a-15*t)
        return x+sin(a)*f,y,z+cos(a)*f
    m.lathe(shape,(0,0,0),paint,lambda t:skin('Pelvis','Chest',ramp(.015,.32,t)),rings=22,sides=25,warp=warp)
    if style=='robe':
        # Front hem drapes over the thighs rather than staying rigid on the pelvis.
        # Rear hem remains largely pelvis-bound for seated silhouettes.
        for i,(x,y,z) in enumerate(m.points):
            if y>=h+.015:continue
            amount=(1-ramp(h-.19,h+.015,y))*(.12+.78*ramp(-.09,.12,z))
            right=ramp(-.085,.085,x)
            m.weights[i]={'Pelvis':1-amount,'ThighL':amount*(1-right),'ThighR':amount*right}
    collar=[((.077*sin(a),n-.012-.006*cos(a),.070*cos(a)-.014),.0045)
            for a in [2*pi*t for t in steps(26)]]
    m.cord(collar,trim,solid('Chest'),sides=5)
    r.sleeves(m,top,trim,long=long,style=style)
    if hoodie:
        # Folded hood sits on the upper back; no new head or hair geometry.
        hood=[((x,s+y,z),rad) for x,y,z,rad in
              [(-.089,.060,-.050,.020),(-.087,.030,-.094,.028),
               (-.061,-.022,-.135,.033),(0,-.050,-.155,.037),
               (.061,-.022,-.135,.033),(.087,.030,-.094,.028),(.089,.060,-.050,.020)]]
        m.cord(hood,top,solid('Chest'),sides=9)
        for side in (-1,1):
            m.cord([((side*.045,n-.026,.070),.003),((side*.047,s-.041,.108),.003),
                    ((side*.050,s-.109,.125),.003)],trim,solid('Chest'),sides=5)
        # Flat kangaroo-pocket seam, aligned to the chest rather than a floating patch.
        for side in (-1,1):
            m.cord([((side*.032,h+.205,.113),.0027),((side*.091,h+.181,.103),.0027),
                    ((side*.120,h+.100,.095),.0027)],trim,solid('Chest'),sides=5)
    if style=='olympic':
        for side in (-1,1):
            for y0,y1 in zip([hem+.012,h+.15,s-.135,s-.045],[h+.15,s-.135,s-.045,n-.022]):
                pts=[]
                for y in (y0,y1):
                    rx,rz,cz=profile(shape,y);a=.38+.14*(y-hem)/(n-hem);pts.append(((side*rx*sin(a),y,rz*cos(a)+cz+.003),.0035))
                m.cord(pts,blend(top,trim,.35),skin('Pelvis','Chest',ramp(.015,.32,((y0+y1)/2-hem)/(n-hem))),sides=5)
    elif style in ('zip','track'):
        # Zip seam follows the front garment profile and its skin weights.
        for y0,y1 in zip([hem+.02,h+.15,s-.135,s-.045],[h+.15,s-.135,s-.045,n-.022]):
            pts=[]
            for y in (y0,y1):
                rx,rz,cz=profile(shape,y);pts.append(((0,y,rz+cz+.004),.0025))
            m.cord(pts,trim,skin('Pelvis','Chest',ramp(.015,.32,((y0+y1)/2-hem)/(n-hem))),sides=5)
    elif style=='polo':
        for side in (-1,1):
            m.cord([((side*.071,n-.015,.052),.018),((side*.055,n-.052,.082),.017),((side*.034,s-.041,.102),.009)],trim,solid('Chest'),sides=6)
        m.cord([((0,n-.019,.072),.004),((0,s-.115,.126),.004)],trim,solid('Chest'),sides=5)
    elif style=='classic':
        # Small left breast pocket on the cream tee.
        m.cord([((-.058,s-.130,.121),.0017),((-.113,s-.130,.113),.0017),
                ((-.111,s-.188,.107),.0017),((-.061,s-.188,.115),.0017),
                ((-.058,s-.130,.121),.0017)],trim,solid('Chest'),sides=5)
    return m


def lower_mesh(r, look, color, style):
    m = Mesh(look+' lower', 'Denim pigment' if style=='jeans' else 'Cloth pigment', .9)
    h,k = r.hip,r.leg
    seam=blend(color,rgb('b9b0a4'),.25)
    seat=[(h-.113,.046,.050,-.017),(h-.092,.133,.082,-.014),
          (h-.047,.173,.098,-.010),(h-.009,.179,.101,-.008),(h+.034,.152,.092,-.008)]
    m.lathe(seat,(0,0,0),lambda t,a:blend(color,seam,.10*max(0,cos(a))),lambda _:solid('Pelvis'),rings=7,sides=20)
    for side,suffix in ((-1,'L'),(1,'R')):
        x=side*.111
        thigh,knee='Thigh'+suffix,'Knee'+suffix
        shape=[(.060,.050,.067,-.015),(.116,.059,.067,-.010),(.183,.064,.069,-.011),
               (h-k-.110,.068,.073,-.014),(h-k,.074,.077,0),
               (h-.247,.083,.085,-.017),(h-.105,.091,.092,-.013),
               (h+.012,.094,.099,-.010),(h+.048,.061,.078,-.018)]
        if style=='cargo':
            shape=[(y,rx+.019,rz+.013,z) for y,rx,rz,z in shape]
        if style=='wide':
            shape=[(y,rx+.035*(1-ramp(h-.19,h,y)),rz+.025*(1-ramp(h-.19,h,y)),z) for y,rx,rz,z in shape]
        if style=='highrise':
            shape=[(y,rx*.96,rz*.98,z) for y,rx,rz,z in shape]
        if style=='trousers':
            shape=[(y,rx+.012*(1-ramp(h-.20,h,y)),rz+.008*(1-ramp(h-.20,h,y)),z) for y,rx,rz,z in shape]
        if style in ('joggers','track'):
            shape=[(y,rx+.014*ramp(.09,.25,y),rz+.009*ramp(.09,.25,y),z) for y,rx,rz,z in shape]
        def bind(y):
            return skin(knee,thigh,(y-h+k+.104)/.189) if y<h-.133 else skin(thigh,'Pelvis',(y-h+.115)/.156)
        def fall(xx,y,z,a,t):
            shift=-side*.026*ramp(h-.125,h+.050,y)
            return xx+shift,y,z
        short=style in ('shorts','denimshorts','sportshorts','robeShort')
        cut=h-(.175 if style=='robeShort' else .235 if style=='denimshorts' else .195 if style=='sportshorts' else .205 if r.woman else .355)
        leg=shape
        if short:
            leg=[(cut,*profile(shape,cut))]+[ring for ring in shape if ring[0]>cut]
            # The exposed calf/thigh is part of this replacement lower mesh;
            # never overlay full trousers with shorts.
            bare=[(.098,.037,.044,-.008),(.175,.047,.050,-.008),
                  (h-k-.075,.055,.058,-.009),(h-k,.060,.061,0),
                  (h-.247,.067,.068,-.011),(h-.105,.077,.078,-.010)]
            end=cut+.015
            exposed=[ring for ring in bare if ring[0]<end]+[(end,*profile(bare,end))]
            m.lathe(exposed,(x,0,0),lambda t,a:blend(r.portrait.base,rgb('a37366'),.10*max(0,-cos(a))),
                    lambda t:bind(exposed[0][0]+(end-exposed[0][0])*t),rings=15,sides=18,warp=fall)
        def fabric(t,a):
            crease=bell(sin(a)*11)*max(0,cos(a))
            cuff=(1-ramp(.025,.10,t)) if short or style in ('joggers','track') else 0
            if style=='track':
                # Three parallel bands on the outside of each leg.
                stripe=max(bell((sin(a)-side*.94)/.035)*bell((cos(a)-v)/.11) for v in (-.32,0,.32))
                return blend(color,rgb('f3eee5'),stripe*.95+.05*cuff)
            return blend(color,seam,.16*crease+.11*max(0,cos(a))+.42*cuff)
        m.lathe(leg,(x,0,0),fabric,lambda t:bind(leg[0][0]+(leg[-1][0]-leg[0][0])*t),
                rings=18,sides=48 if style=='track' else 18,warp=fall)
        if style=='cargo':
            for yy in (h-.23,h-.36):
                rx,rz,cz=profile(shape,yy)
                m.cord([((x+side*(rx+.001),yy,cz-.045),.006),((x+side*(rx+.003),yy,cz+.045),.006)],seam,bind(yy),sides=5)
    return m


def sneakers(r, color, accent, kind):
    m=Mesh('Laced sneakers','Footwear',.58)
    sole=rgb('eee9df')
    for side,suffix in ((-1,'L'),(1,'R')):
        x=side*.111
        ankle='Ankle'+suffix
        shape=[(.004,.065,.132,.042),(.018,.073,.144,.044),(.037,.073,.144,.044),
               (.052,.071,.136,.043),(.082,.064,.114,.034),(.111,.056,.080,.009),(.126,.049,.060,-.005)]
        if kind=='runner':
            shape=[(y,rx*1.10,rz*1.04,cz) for y,rx,rz,cz in shape]
        if kind=='high':
            shape[-1]=(.148,.052,.062,-.005)
            shape.append((.175,.048,.054,-.007))
        if kind=='canvas':
            shape=[(y,rx*.96,rz*.98,cz) for y,rx,rz,cz in shape]
        m.lathe(shape,(x,0,0),lambda t,a:blend(color,sole,1-ramp(.29,.42,t)),
                lambda _:solid(ankle),rings=12,sides=24)
        for z,y in [(.095,.108),(.119,.097),(.141,.085),(.158,.077)]:
            m.cord([((x-.030,y-.005,z),.0026),((x,y,z),.003),((x+.030,y-.005,z),.0026)],sole,solid(ankle),sides=5)
        for flank in (-1,1):
            m.cord([((x+flank*.062,.065,-.005),.0035),((x+flank*.069,.062,.075),.0035),((x+flank*.058,.061,.124),.0035)],accent,solid(ankle),sides=5)
    return m

def add_wardrobe(resident, rig):
    shoes={
        'alina': [('e7c1c6','fff3ed','canvas'),('dedad0','778fa6','high'),('cbd4dd','9b849f','runner'),('b5a4c6','e8e0dc','canvas'),('d7bca0','ece8e1','high'),('f2eee3','6a88a1','canvas'),('b7788b','e8dad1','canvas'),('637b99','dce6ea','runner'),('535963','e4d7c5','high'),('a8c1c4','e6e7e0','runner'),('90828f','e0d8e1','runner')],
        'vlad': [('48604b','ddd8be','canvas'),('a9513f','e9dcd0','high'),('343435','bdac92','canvas'),('6a899c','dbe1df','runner'),('a39b8b','383e45','high'),('202933','f3eee5','runner'),('365d78','ddd4c0','canvas'),('5d684a','d5c0a0','high'),('b1b6b3','354b55','runner'),('9a694a','e6d7bb','runner'),('e4dfd0','7491a4','canvas')],
    }
    for (look,*_), (color,accent,kind) in zip(LOOKS[resident.name],shoes[resident.name]):
        resident.garment(rig,sneakers(resident,rgb(color),rgb(accent),kind),'footwear',look)
    for look,top,trim,bottom,style,cut in LOOKS[resident.name]:
        resident.garment(rig,top_mesh(resident,look,rgb(top),rgb(trim),cut),'upper',look)
        resident.garment(rig,lower_mesh(resident,look,rgb(bottom),style),'lower',look)
