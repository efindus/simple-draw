/**
 * @type {Node}
*/
const svg = document.getElementById('svg');
const grid = document.getElementById('grid');
const vline = document.getElementById('vline');
const hline = document.getElementById('hline');
const lineButton = document.getElementById('line-button');
const pointButton = document.getElementById('point-button');
const eraserButton = document.getElementById('eraser-button');
const positionDisplay = document.getElementById('position-display');

const d = {
    pos: {
        x: svg.clientWidth / 2,
        y: svg.clientHeight / 2,
        scale: 0.01,
    },
    objects: {
        points: {},
        lines: {},
    },
    actionList: [],
    last: {
        pos: {
            x: 0,
            y: 0,
        },
        svgSize: {
            width: svg.clientWidth,
            height: svg.clientHeight,
        },
        clickTS: 0,
    },
    dragging: false,
    current: {
        brush: 'point',
        startPos: {
            x: null,
            y: null,
        },
        element: null,
    },
};

const get = (coord, offset = 0, rounded = false) => {
    let val = (-d.pos[coord] + offset) * d.pos.scale;
    if (rounded)
        val = Math.round(val);

    return val;
};

const updateViewBox = () => {
    const widthDiff = d.last.svgSize.width - svg.clientWidth, heightDiff = d.last.svgSize.height - svg.clientHeight;
    if (widthDiff || heightDiff) {
        d.last.svgSize.width = svg.clientWidth, d.last.svgSize.height = svg.clientHeight;
        d.pos.x -= widthDiff / 2, d.pos.y -= heightDiff / 2;
    }

    const x = get('x'), y = get('y');
    const width = svg.clientWidth * d.pos.scale, height = svg.clientHeight * d.pos.scale;
    svg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
    grid.setAttribute('x', x);
    grid.setAttribute('y', y);
    grid.setAttribute('width', width);
    grid.setAttribute('height', height);
    vline.setAttribute('y1', y);
    vline.setAttribute('y2', y + height);
    hline.setAttribute('x1', x);
    hline.setAttribute('x2', x + width);
};

const svgOnResize = new ResizeObserver(updateViewBox);
svgOnResize.observe(svg);

const addPoint = (points, x, y, data) => {
    if (!points[x])
        points[x] = {};

    points[x][y] = data;
};

const getPoint = (points, x, y) => {
    let data = points[x] ?? null;
    if (data)
        data = data[y] ?? null;

    return data;
};

const removePoint = (points, x, y) => {
    if (points[x][y])
        delete points[x][y];

    if (points[x] && Object.keys(points[x]).length === 0)
        delete points[x];
};

const processUpdate = (offsetX, offsetY) => {
    const posX = get('x', offsetX, true), posY = get('y', offsetY, true);
    positionDisplay.innerText = `${posX}; ${-posY}`;
};

const togglePointAt = (pX, pY, byUser = false) => {
    const pointData = getPoint(d.objects.points, pX, pY);
    if (!pointData) {
        const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        addPoint(d.objects.points, pX, pY, { element: point });
        point.classList.add('svg-point');
        point.setAttribute('r', 0.06);
        point.setAttribute('cx', pX);
        point.setAttribute('cy', pY);
        svg.appendChild(point);

        if (byUser)
            d.actionList.push({ action: 'add', at: { x: pX, y: pY } });

        pY = -pY;
    } else {
        if (byUser)
            d.actionList.push({ action: 'remove', at: { x: pX, y: pY } });

        pointData.element.remove();
        removePoint(d.objects.points, pX, pY);
    }
};

const processLineAt = (pX, pY) => {
    if (!d.current.element) {
        d.current.startPos = {
            x: pX,
            y: pY,
        };

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        d.current.element = line;
        line.classList.add('svg-line');
        line.setAttribute('x1', pX);
        line.setAttribute('y1', pY);
        line.setAttribute('x2', get('x', d.last.pos.x));
        line.setAttribute('y2', get('y', d.last.pos.y));
        svg.appendChild(line);
    } else {
        if (d.current.startPos.x === pX && d.current.startPos.y === pY) {
            endDraw();
        } else {
            d.current.element.setAttribute('x2', get('x', d.last.pos.x, true));
            d.current.element.setAttribute('y2', get('y', d.last.pos.y, true));
            endDraw(false);
        }
    }
};

const processEraserAt = (pX, pY) => {
    const element = document.elementFromPoint(pX, pY);
    const erasable = [ 'point', 'line' ].some(v => element.classList.contains(`svg-${v}`));
    if (erasable)
        element.remove();
};

const endDraw = (cancel = true) => {
    if (cancel)
        d.current.element?.remove();
    
    d.current.element = null;
};

const selectButton = (element) => {
    pointButton.classList.remove('active');
    lineButton.classList.remove('active');
    eraserButton.classList.remove('active');

    element.classList.add('active');
};

pointButton.addEventListener('click', () => {
    d.current.brush = 'point';
    endDraw();
    selectButton(pointButton);
});

lineButton.addEventListener('click', () => {
    d.current.brush = 'line';
    endDraw();
    selectButton(lineButton);
});

eraserButton.addEventListener('click', () => {
    d.current.brush = 'eraser';
    endDraw();
    selectButton(eraserButton);
});

svg.addEventListener('mousemove', (event) => {
    if (d.dragging) {
        d.pos.x += (event.offsetX - d.last.pos.x);
        d.pos.y += (event.offsetY - d.last.pos.y);
        d.last.pos.x = event.offsetX, d.last.pos.y = event.offsetY;
        updateViewBox();
    }

    if (d.current.element) {
        if (d.current.brush === 'line') {
            d.current.element.setAttribute('x2', get('x', event.offsetX));
            d.current.element.setAttribute('y2', get('y', event.offsetY));
        }
    }

    processUpdate(event.offsetX, event.offsetY);
});

svg.addEventListener('wheel', (event) => {
    const preX = get('x', event.offsetX), preY = get('y', event.offsetY);
    d.pos.scale *= (1 + 0.001 * event.deltaY);

    // Keep mouse position constant
    d.pos.x = -((preX / d.pos.scale) - event.offsetX), d.pos.y = -((preY / d.pos.scale) - event.offsetY);
    updateViewBox();
});

svg.addEventListener('mousedown', (event) => {
    d.last.pos.x = event.offsetX, d.last.pos.y = event.offsetY;
    d.dragging = true;
    d.last.clickTS = Date.now();
});

document.addEventListener('mouseup', (event) => {
    d.dragging = false;
    if (Date.now() - d.last.clickTS <= 200) {
        const posX = get('x', d.last.pos.x, true), posY = get('y', d.last.pos.y, true);
        if (d.current.brush === 'point')
            togglePointAt(posX, posY, true);
        else if (d.current.brush === 'line')
            processLineAt(posX, posY);
        else if (d.current.brush === 'eraser')
            processEraserAt(event.clientX, event.clientY);
    }
});

document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 'z') {
        if (d.actionList.length) {
            const a = d.actionList[d.actionList.length - 1];
            d.actionList.pop();
            if (a.action === 'add' || a.action === 'remove')
                togglePointAt(a.at.x, a.at.y);
        }
    }
});
