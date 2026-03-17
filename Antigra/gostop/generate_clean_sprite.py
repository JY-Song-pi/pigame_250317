from PIL import Image, ImageDraw, ImageFont
import math

# We will increase the resolution significantly to ensure high quality rendering
img_w = 2400
img_h = 1200
cols = 12
rows = 4
card_w = img_w // cols  # 200
card_h = img_h // rows  # 300

# Create a high res image
img = Image.new('RGBA', (img_w, img_h), (255, 255, 255, 0))
draw = ImageDraw.Draw(img, 'RGBA')

deck_info = {
    1: ['Kwang', 'Hongdan', 'Pi', 'Pi'],
    2: ['Yul', 'Hongdan', 'Pi', 'Pi'],
    3: ['Kwang', 'Hongdan', 'Pi', 'Pi'],
    4: ['Yul', 'Chodan', 'Pi', 'Pi'],
    5: ['Yul', 'Chodan', 'Pi', 'Pi'],
    6: ['Yul', 'Cheongdan', 'Pi', 'Pi'],
    7: ['Yul', 'Chodan', 'Pi', 'Pi'],
    8: ['Kwang', 'Yul', 'Pi', 'Pi'],
    9: ['Yul_Ssangpi', 'Cheongdan', 'Pi', 'Pi'],
    10: ['Yul', 'Cheongdan', 'Pi', 'Pi'],
    11: ['Kwang', 'Ssangpi', 'Pi', 'Pi'],
    12: ['Kwang_Bi', 'Yul', 'Tti_Bi', 'Ssangpi']
}

colors = {
    'bg': '#FFFAF0',       # Ivory white for background
    'border': '#111111',   # Dark almost black
    'red': '#D32F2F',      # Deep classic red
    'blue': '#1976D2',     # Classic blue
    'yellow': '#FBC02D',   # Bright gold/yellow
    'black': '#212121',    # Pure dark
    'green': '#388E3C',    # Leaf green
    'purple': '#7B1FA2',   # Purple/Violet
    'brown': '#795548',
    'white': '#FFFFFF',
    'sky': '#87CEEB'
}

def draw_rounded_rect(draw, x, y, w, h, radius, fill, outline, width=3):
    draw.rounded_rectangle([x, y, x + w, y + h], radius, fill=fill, outline=outline, width=width)

def draw_pine(draw, cx, cy, cw, ch):
    """1월 송학 (Pine)"""
    draw.ellipse([cx+cw*0.1, cy+ch*0.5, cx+cw*0.9, cy+ch*0.9], fill=colors['green'], outline=colors['border'], width=3)
    draw.polygon([(cx+cw*0.5, cy+ch*0.1), (cx+cw*0.2, cy+ch*0.6), (cx+cw*0.8, cy+ch*0.6)], fill=colors['black'])

def draw_plum(draw, cx, cy, cw, ch):
    """2월 매화 (Plum Blossom)"""
    for x_off, y_off in [(0.3, 0.4), (0.7, 0.3), (0.5, 0.7)]:
        draw.ellipse([cx+cw*(x_off-0.15), cy+ch*(y_off-0.1), cx+cw*(x_off+0.15), cy+ch*(y_off+0.1)], fill=colors['red'], outline=colors['border'], width=2)
    draw.line([(cx+cw*0.5, cy+ch*0.8), (cx+cw*0.5, cy+ch*0.4)], fill=colors['brown'], width=8)

def draw_cherry(draw, cx, cy, cw, ch):
    """3월 벚꽃 (Cherry Blossom)"""
    draw.ellipse([cx+cw*0.2, cy+ch*0.2, cx+cw*0.8, cy+ch*0.8], fill=(255, 182, 193, 255), outline=colors['border'], width=2)
    draw.line([(cx+cw*0.1, cy+ch*0.9), (cx+cw*0.9, cy+ch*0.9)], fill=colors['brown'], width=10)

def draw_wisteria(draw, cx, cy, cw, ch):
    """4월 흑싸리 (Wisteria)"""
    for i in range(5):
        y = cy + ch * (0.2 + i * 0.15)
        draw.ellipse([cx+cw*0.3, y, cx+cw*0.4, y+ch*0.1], fill=colors['black'])
        draw.ellipse([cx+cw*0.6, y, cx+cw*0.7, y+ch*0.1], fill=colors['black'])
    draw.line([(cx+cw*0.5, cy+ch*0.1), (cx+cw*0.5, cy+ch*0.9)], fill=colors['green'], width=4)

def draw_iris(draw, cx, cy, cw, ch):
    """5월 난초 (Iris)"""
    draw.polygon([(cx+cw*0.2, cy+ch*0.9), (cx+cw*0.4, cy+ch*0.3), (cx+cw*0.5, cy+ch*0.9)], fill=colors['green'])
    draw.polygon([(cx+cw*0.8, cy+ch*0.9), (cx+cw*0.6, cy+ch*0.4), (cx+cw*0.5, cy+ch*0.9)], fill=colors['green'])
    draw.ellipse([cx+cw*0.4, cy+ch*0.1, cx+cw*0.6, cy+ch*0.3], fill=colors['purple'])

def draw_peony(draw, cx, cy, cw, ch):
    """6월 모란 (Peony)"""
    draw.ellipse([cx+cw*0.2, cy+ch*0.4, cx+cw*0.8, cy+ch*0.9], fill=colors['red'], outline=colors['border'], width=3)
    draw.ellipse([cx+cw*0.3, cy+ch*0.5, cx+cw*0.7, cy+ch*0.8], fill=colors['yellow'])

def draw_clover(draw, cx, cy, cw, ch):
    """7월 홍싸리 (Bush Clover)"""
    for i in range(4):
        y = cy + ch * (0.2 + i * 0.15)
        draw.ellipse([cx+cw*0.3, y, cx+cw*0.45, y+ch*0.1], fill=colors['red'])
        draw.ellipse([cx+cw*0.55, y, cx+cw*0.7, y+ch*0.1], fill=colors['red'])

def draw_moon(draw, cx, cy, cw, ch):
    """8월 공산 (Moon/Geese)"""
    draw.rectangle([cx, cy, cx+cw, cy+ch*0.6], fill=colors['black'])
    draw.ellipse([cx+cw*0.3, cy+ch*0.1, cx+cw*0.7, cy+ch*0.1+cw*0.4], fill=colors['white'])
    # Mountains
    draw.polygon([(cx, cy+ch), (cx+cw*0.5, cy+ch*0.5), (cx+cw, cy+ch)], fill=colors['green'])

def draw_chrysanthemum(draw, cx, cy, cw, ch):
    """9월 국진 (Chrysanthemum)"""
    draw.ellipse([cx+cw*0.2, cy+ch*0.3, cx+cw*0.8, cy+ch*0.8], fill=colors['yellow'], outline=colors['border'], width=3)
    draw.ellipse([cx+cw*0.4, cy+ch*0.5, cx+cw*0.6, cy+ch*0.7], fill=colors['red'])

def draw_maple(draw, cx, cy, cw, ch):
    """10월 단풍 (Maple)"""
    draw.polygon([
        (cx+cw*0.5, cy+ch*0.2), (cx+cw*0.8, cy+ch*0.5), 
        (cx+cw*0.6, cy+ch*0.5), (cx+cw*0.9, cy+ch*0.8),
        (cx+cw*0.1, cy+ch*0.8), (cx+cw*0.4, cy+ch*0.5),
        (cx+cw*0.2, cy+ch*0.5)
    ], fill=colors['red'], outline=colors['border'], width=3)

def draw_paulownia(draw, cx, cy, cw, ch):
    """11월 오동 (Paulownia)"""
    draw.rectangle([cx, cy+ch*0.5, cx+cw, cy+ch], fill=colors['black'])
    draw.ellipse([cx+cw*0.2, cy+ch*0.6, cx+cw*0.5, cy+ch*0.9], fill=colors['yellow'])
    draw.ellipse([cx+cw*0.6, cy+ch*0.1, cx+cw*0.9, cy+ch*0.4], fill=colors['black'])

def draw_rain(draw, cx, cy, cw, ch):
    """12월 비 (Rain/Willow)"""
    draw.rectangle([cx, cy, cx+cw, cy+ch], fill=colors['sky'])
    draw.polygon([(cx+cw*0.1, cy+ch), (cx+cw*0.3, cy+ch*0.4), (cx+cw*0.5, cy+ch)], fill=colors['green'])
    draw.polygon([(cx+cw*0.6, cy+ch), (cx+cw*0.6, cy+ch*0.5), (cx+cw*0.8, cy+ch)], fill=colors['black'])


month_drawers = {
    1: draw_pine, 2: draw_plum, 3: draw_cherry, 4: draw_wisteria,
    5: draw_iris, 6: draw_peony, 7: draw_clover, 8: draw_moon,
    9: draw_chrysanthemum, 10: draw_maple, 11: draw_paulownia, 12: draw_rain
}


for month in range(1, 13):
    cards = deck_info[month]
    for row, ctype in enumerate(cards):
        cx = (month - 1) * card_w
        cy = row * card_h
        
        # Card Background
        pad = 6
        cb_x1, cb_y1 = cx + pad, cy + pad
        cb_x2, cb_y2 = cx + card_w - pad, cy + card_h - pad
        draw_rounded_rect(draw, cb_x1, cb_y1, card_w - 2 * pad, card_h - 2 * pad, 12, fill=colors['bg'], outline=colors['border'], width=4)
        
        # Draw base month illustration
        month_drawers[month](draw, cb_x1, cb_y1, card_w - 2*pad, card_h - 2*pad)

        mid_x = cx + card_w / 2
        mid_y = cy + card_h / 2

        # Draw specific traits
        if 'Kwang' in ctype:
            # Red circle with '光'
            draw.ellipse([mid_x - 35, mid_y - 35, mid_x + 35, mid_y + 35], fill=colors['red'], outline=colors['white'], width=4)
            draw.text((mid_x, mid_y), "光", fill=colors['white'], anchor="mm", font_size=40)
            
        if 'Hongdan' in ctype:
            # Red ribbon
            draw.rectangle([cx+30, mid_y-25, cx+card_w-30, mid_y+25], fill=colors['red'], outline=colors['border'], width=3)
            draw.text((mid_x, mid_y), "홍단", fill=colors['white'], anchor="mm", font_size=32)
            
        elif 'Cheongdan' in ctype:
            # Blue ribbon
            draw.rectangle([cx+30, mid_y-25, cx+card_w-30, mid_y+25], fill=colors['blue'], outline=colors['border'], width=3)
            draw.text((mid_x, mid_y), "청단", fill=colors['white'], anchor="mm", font_size=32)
            
        elif 'Chodan' in ctype:
            # Red ribbon, no distinct text (just red tti)
            draw.rectangle([cx+30, mid_y-25, cx+card_w-30, mid_y+25], fill=colors['red'], outline=colors['border'], width=3)
            draw.text((mid_x, mid_y), "초단", fill=colors['white'], anchor="mm", font_size=32)
            
        elif ctype == 'Tti_Bi':
            # Rain Tti
            draw.rectangle([cx+30, mid_y-25, cx+card_w-30, mid_y+25], fill=colors['red'], outline=colors['border'], width=3)
            
        if 'Yul' in ctype:
            # Animal / object symbol
            draw.ellipse([mid_x - 40, cy + 40, mid_x + 40, cy + 120], fill=colors['green'], outline=colors['border'], width=3)
            draw.text((mid_x, cy + 80), "열끗", fill=colors['white'], anchor="mm", font_size=28)
            
        if 'Ssangpi' in ctype:
            # Ssangpi indicator
            draw.ellipse([mid_x - 40, cy + 40, mid_x + 40, cy + 120], fill=colors['bg'], outline=colors['red'], width=6)
            draw.text((mid_x, cy + 80), "쌍피", fill=colors['red'], anchor="mm", font_size=32)

        # Draw number in corner just to be extremely clear what card it is (modernizing)
        draw.ellipse([cx + 12, cy + 12, cx + 52, cy + 52], fill=colors['white'], outline=colors['border'], width=2)
        draw.text((cx + 32, cy + 32), str(month), fill=colors['black'], anchor="mm", font_size=24)

print("Saving enhanced Hwatu sprite...")
img.save('img/hwatu_sprite.png')
print("Complete.")
