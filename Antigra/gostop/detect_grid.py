from PIL import Image

def detect_grid(img_path):
    img = Image.open(img_path).convert('RGBA')
    w, h = img.size
    pixels = img.load()

    # Find rows that are not completely empty/transparent
    row_has_pixels = []
    
    # Check if the "empty" space is transparent or white
    # Let's check the very top-left pixel
    bg_color = pixels[0, 0]
    
    def is_bg(x, y):
        r, g, b, a = pixels[x, y]
        if a < 10: return True
        # If it's a solid background color (e.g. white or green)
        if abs(r - bg_color[0]) < 10 and abs(g - bg_color[1]) < 10 and abs(b - bg_color[2]) < 10 and abs(a - bg_color[3]) < 10:
            return True
        return False

    y_borders = []
    in_card = False
    start_y = 0
    for y in range(h):
        row_empty = True
        for x in range(w):
            if not is_bg(x, y):
                row_empty = False
                break
        
        if not row_empty and not in_card:
            in_card = True
            start_y = y
        elif row_empty and in_card:
            in_card = False
            y_borders.append((start_y, y - 1))
            
    if in_card:
        y_borders.append((start_y, h - 1))

    # Same for columns
    x_borders = []
    in_card = False
    start_x = 0
    for x in range(w):
        col_empty = True
        for y in range(h):
            if not is_bg(x, y):
                col_empty = False
                break
                
        if not col_empty and not in_card:
            in_card = True
            start_x = x
        elif col_empty and in_card:
            in_card = False
            x_borders.append((start_x, x - 1))
            
    if in_card:
        x_borders.append((start_x, w - 1))

    print("Background color considered:", bg_color)
    print("Detected Rows (Y ranges):", y_borders)
    print("Number of Rows:", len(y_borders))
    print("Detected Columns (X ranges):", x_borders)
    print("Number of Columns:", len(x_borders))
    
    if len(y_borders) > 0 and len(x_borders) > 0:
        card_w = x_borders[0][1] - x_borders[0][0] + 1
        card_h = y_borders[0][1] - y_borders[0][0] + 1
        print(f"Typical Card Size: {card_w} x {card_h}")
    else:
        print("Could not detect clear grid based on background color.")

if __name__ == "__main__":
    detect_grid('img/hwatu_sprite.png')
