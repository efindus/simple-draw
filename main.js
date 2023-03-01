const canvas = document.getElementById('canvas');
/**
 * @type {CanvasRenderingContext2D}
 */
const ctx = canvas.getContext('2d');

const lineButton = document.getElementById('line-button');
const pointButton = document.getElementById('point-button');
const eraserButton = document.getElementById('eraser-button');
const positionDisplay = document.getElementById('position-display');

const smallGridWidth = 0.01, bigGridWidth = 0.015, axisWidth = 0.025, pointSize = 0.06, lineWidth = 0.04;

const d = {
    pos: {
        x: 0,
        y: 0,
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
        canvasSize: {
            width: 0,
            height: 0,
        },
        clickTS: 0,
    },
    dragging: false,
    drawing: false,
    current: {
        brush: 'point',
        startPos: {
            x: null,
            y: null,
        },
        mousePos: {
            x: null,
            y: null,
        },
    },
};

const get = (coord, offset = 0, rounded = false) => {
    let val = (-d.pos[coord] + offset) * d.pos.scale;
    if (rounded)
        val = Math.round(val);

    return val;
};

const renderCanvas = () => {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    const x = get('x'), y = get('y'), x2 = get('x', width), y2 = get('y', height);
    
    // Optimization shortcut as you cannot see anything anyway
    if (d.pos.scale >= 2) {
        ctx.fillStyle = '#fdfdfd';
        ctx.fillRect(0, 0, width, height);
        return;
    }

    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    ctx.lineCap = 'butt';

    // 1x1 grid
    const sSmallGridWidth = smallGridWidth / d.pos.scale, s2SmallGridWidth = sSmallGridWidth / 2;
    ctx.lineWidth = sSmallGridWidth;
    ctx.strokeStyle = 'gray';
    ctx.beginPath();

    for (let i = Math.ceil(x - s2SmallGridWidth); i <= Math.floor(x2 + s2SmallGridWidth); i++) {
        const offset = (i - x) / d.pos.scale;

        ctx.moveTo(offset, 0);
        ctx.lineTo(offset, height);
    }

    for (let i = Math.ceil(y - s2SmallGridWidth); i <= Math.floor(y2 + s2SmallGridWidth); i++) {
        const offset = (i - y) / d.pos.scale;

        ctx.moveTo(0, offset);
        ctx.lineTo(width, offset);
    }

    ctx.stroke();

    // 5x5 grid
    const sBigGridWidth = bigGridWidth / d.pos.scale, s2BigGridWidth = sBigGridWidth / 2;
    ctx.lineWidth = sBigGridWidth;
    ctx.strokeStyle = 'gray';
    ctx.beginPath();

    for (let i = Math.ceil(x - s2BigGridWidth); i <= Math.floor(x2 + s2BigGridWidth); i += 5) {
        if (i % 5 !== 0)
            i += (i % 5 < 0) ? Math.abs(i % 5) : 5 - (i % 5);

        const offset = (i - x) / d.pos.scale;

        ctx.moveTo(offset, 0);
        ctx.lineTo(offset, height);
    }

    for (let i = Math.ceil(y - s2BigGridWidth); i <= Math.floor(y2 + s2BigGridWidth); i += 5) {
        if (i % 5 !== 0)
            i += (i % 5 < 0) ? Math.abs(i % 5) : 5 - (i % 5);

        const offset = (i - y) / d.pos.scale;

        ctx.moveTo(0, offset);
        ctx.lineTo(width, offset);
    }

    ctx.stroke();

    // Axis lines
    const sAxisWidth = axisWidth / d.pos.scale, s2AxisWidth = sAxisWidth / 2;
    const xAxis = (x - s2AxisWidth <= 0 && 0 <= x2 + s2AxisWidth), yAxis = (y - s2AxisWidth <= 0 && 0 <= y2 + s2AxisWidth);
    if (xAxis || yAxis) {
        ctx.lineWidth = sAxisWidth;
        ctx.strokeStyle = '#3a3a3a';
        ctx.beginPath();

        if (xAxis) {
            const offset = (0 - x) / d.pos.scale;

            ctx.moveTo(offset, 0);
            ctx.lineTo(offset, height);
        }

        if (yAxis) {
            const offset = (0 - y) / d.pos.scale;

            ctx.moveTo(0, offset);
            ctx.lineTo(width, offset);
        }

        ctx.stroke();
    }

    // Points
    const sPointSize = pointSize / d.pos.scale, s2PointSize = sPointSize / 2;
    ctx.fillStyle = 'black';
    ctx.beginPath();
    
    for (const posX of Object.keys(d.objects.points)) {
        const pX = +posX;
        if (!(x - s2PointSize <= pX && pX <= x2 + s2PointSize))
            continue;

        for (const posY of Object.keys(d.objects.points[posX])) {
            const pY = +posY;
            if (!(y - s2PointSize <= pY && pY <= y2 + s2PointSize))
                continue;

            const offsetX = (pX - x) / d.pos.scale;
            const offsetY = (pY - y) / d.pos.scale;
            ctx.moveTo(offsetX, offsetY);
            ctx.arc(offsetX, offsetY, sPointSize, 0, 2 * Math.PI);
        }
    }

    ctx.closePath();
    ctx.fill();

    // Lines
    const sLineWidth = lineWidth / d.pos.scale, s2LineWidth = sLineWidth / 2;
    ctx.lineCap = 'round';
    ctx.lineWidth = sLineWidth;
    ctx.strokeStyle = 'black';
    ctx.beginPath();

    if (d.drawing && d.current.brush === 'line') {
        const startX = (d.current.startPos.x - x) / d.pos.scale, startY = (d.current.startPos.y - y) / d.pos.scale;
        const mouseX = (d.current.mousePos.x - x) / d.pos.scale, mouseY = (d.current.mousePos.y - y) / d.pos.scale;

        ctx.moveTo(startX, startY);
        ctx.lineTo(mouseX, mouseY);
    }

    for (const startX of Object.keys(d.objects.lines)) {
        for (const startY of Object.keys(d.objects.lines[startX])) {
            const start = d.objects.lines[startX][startY], sX = +startX, sY = +startY;

            for (const endX of Object.keys(start)) {
                for (const endY of Object.keys(start[endX])) {
                    const eX = +endX, eY = +endY;

                    ctx.moveTo((sX - x) / d.pos.scale, (sY - y) / d.pos.scale);
                    ctx.lineTo((eX - x) / d.pos.scale, (eY - y) / d.pos.scale);
                }
            }
        }
    }

    ctx.stroke();
};

const updateCanvas = () => {
    const widthDiff = d.last.canvasSize.width - canvas.clientWidth, heightDiff = d.last.canvasSize.height - canvas.clientHeight;
    if (widthDiff || heightDiff) {
        canvas.setAttribute('width', canvas.clientWidth);
        canvas.setAttribute('height', canvas.clientHeight);

        d.last.canvasSize.width = canvas.clientWidth, d.last.canvasSize.height = canvas.clientHeight;
        d.pos.x -= widthDiff / 2, d.pos.y -= heightDiff / 2;
    }

    renderCanvas();
};

const canvasOnResize = new ResizeObserver(updateCanvas);
canvasOnResize.observe(canvas);

const addPoint = (points, x, y, data, overwrite = false) => {
    points[x] ??= {};

    if (overwrite)
        points[x][y] = data;
    else
        points[x][y] ??= data;

    return points[x][y];
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

const togglePointAt = (pX, pY, byUser = false) => {
    const pointData = getPoint(d.objects.points, pX, pY);
    if (!pointData) {
        addPoint(d.objects.points, pX, pY, true);

        if (byUser)
            d.actionList.push({ action: 'add', at: { x: pX, y: pY } });
    } else {
        if (byUser)
            d.actionList.push({ action: 'remove', at: { x: pX, y: pY } });

        removePoint(d.objects.points, pX, pY);
    }
};

const drawLineAt = (pX, pY) => {
    if (!d.drawing) {
        d.current.startPos = {
            x: pX,
            y: pY,
        };

        d.current.mousePos = {
            x: pX,
            y: pY,
        };

        d.drawing = true;
    } else {
        if (d.current.startPos.x !== pX || d.current.startPos.y !== pY) {
            let s = d.current.startPos, e = { x: pX, y: pY };
            if (s.x > e.x)
                [ s, e ] = [ e, s ];
            else if (s.x === e.x && s.y > e.y)
                [ s, e ] = [ e, s ];

            const a = addPoint(d.objects.lines, s.x, s.y, {});
            if (getPoint(a, e.x, e.y))
                removePoint(a, e.x, e.y);
            else
                addPoint(a, e.x, e.y, true);

            endDraw();
        }

        endDraw();
    }
};

const processEraserAt = (pX, pY) => {
    // const element = document.elementFromPoint(pX, pY);
    // const erasable = [ 'point', 'line' ].some(v => element.classList.contains(`svg-${v}`));
    // if (erasable)
    //     element.remove();
};

const endDraw = () => {
    d.drawing = false;
    updateCanvas();
};

const selectButton = (element) => {
    pointButton.classList.remove('active');
    lineButton.classList.remove('active');
    eraserButton.classList.remove('active');

    element.classList.add('active');
    endDraw();
};

pointButton.addEventListener('click', () => {
    d.current.brush = 'point';
    selectButton(pointButton);
});

lineButton.addEventListener('click', () => {
    d.current.brush = 'line';
    selectButton(lineButton);
});

eraserButton.addEventListener('click', () => {
    d.current.brush = 'eraser';
    selectButton(eraserButton);
});

canvas.addEventListener('mousemove', (event) => {
    let shouldUpdate = false;
    if (d.dragging) {
        d.pos.x += (event.offsetX - d.last.pos.x);
        d.pos.y += (event.offsetY - d.last.pos.y);
        d.last.pos.x = event.offsetX, d.last.pos.y = event.offsetY;
        shouldUpdate = true;
    }

    if (d.drawing) {
        if (d.current.brush === 'line') {
            d.current.mousePos.x = get('x', event.offsetX);
            d.current.mousePos.y = get('y', event.offsetY);
        }

        shouldUpdate = true;
    }

    if (shouldUpdate)
        updateCanvas();

    positionDisplay.innerText = `${get('x', event.offsetX, true)}; ${-get('y', event.offsetY, true)}`;
});

canvas.addEventListener('wheel', (event) => {
    const preX = get('x', event.offsetX), preY = get('y', event.offsetY);
    d.pos.scale *= (1 + 0.001 * event.deltaY);

    // Keep mouse position constant
    d.pos.x = -((preX / d.pos.scale) - event.offsetX), d.pos.y = -((preY / d.pos.scale) - event.offsetY);
    updateCanvas();
});

canvas.addEventListener('mousedown', (event) => {
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
            drawLineAt(posX, posY);
        else if (d.current.brush === 'eraser')
            processEraserAt(event.clientX, event.clientY);

        updateCanvas();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 'z') {
        if (d.actionList.length) {
            const a = d.actionList[d.actionList.length - 1];
            d.actionList.pop();
            if (a.action === 'add' || a.action === 'remove')
                togglePointAt(a.at.x, a.at.y);

            updateCanvas();
        }
    }
});
