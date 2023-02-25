/**
 * @type {Node}
*/
const svg = document.getElementById('svg');
const grid = document.getElementById('grid');
const vline = document.getElementById('vline');
const hline = document.getElementById('hline');
const textSpace = document.getElementById('text-space');
const lineButton = document.getElementById('line-button');
const pointButton = document.getElementById('point-button');
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
        highlight: {
            x: null,
            y: null,
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

const processUpdate = (offsetX, offsetY) => {
    const posX = get('x', offsetX, true), posY = get('y', offsetY, true);
    positionDisplay.innerText = `${posX}; ${-posY}`;

    if (posX === d.last.highlight.x && posY === d.last.highlight.y)
        return;

    if (d.last.highlight.x !== null && d.objects.points[d.last.highlight.x][d.last.highlight.y]) {
        d.objects.points[d.last.highlight.x][d.last.highlight.y].listElement.style.fontWeight = 'normal';
        d.last.highlight.x = null;
    }
        
    if (d.objects.points[posX] && d.objects.points[posX][posY]) {
        d.last.highlight.x = posX, d.last.highlight.y = posY;
        d.objects.points[d.last.highlight.x][d.last.highlight.y].listElement.style.fontWeight = 'bold'
    }
};

const togglePointAt = (pX, pY, byUser = false) => {
    if (!(d.objects.points[pX] && d.objects.points[pX][pY])) {
        if (!d.objects.points[pX])
            d.objects.points[pX] = {};

        const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle'), listElem = document.createElement('div');
        d.objects.points[pX][pY] = { element: point, listElement: listElem };
        point.classList.add('svg-point');
        point.setAttribute('cx', pX);
        point.setAttribute('cy', pY);
        svg.appendChild(point);

        if (byUser) {
            d.actionList.push({ action: 'add', at: { x: pX, y: pY } });
            d.last.highlight.x = pX, d.last.highlight.y = pY;
            listElem.style.fontWeight = 'bold';
        }

        pY = -pY;
        listElem.innerHTML = `(${pX}; ${pY})`;
        let inserted = false;
        for (const element of textSpace.children) {
            let txt = element.innerHTML;
            txt = txt.slice(1, txt.length - 1).split('; ');
            const posX = +txt[0], posY = +txt[1];
            if (pX < posX && (inserted = true))
                textSpace.insertBefore(listElem, element);
            else if (pX > posX)
                continue;
            else if (pY > posY)
                continue;
            else if (pY < posY && (inserted = true))
                textSpace.insertBefore(listElem, element);

            if (inserted)
                break;
        }

        if (!inserted)
            textSpace.appendChild(listElem);
    } else {
        if (byUser)
            d.actionList.push({ action: 'remove', at: { x: pX, y: pY } });

        if (d.last.highlight.x === pX && d.last.highlight.y === pY)
            d.last.highlight.x = null;

        d.objects.points[pX][pY].element.remove();
        d.objects.points[pX][pY].listElement.remove();
        delete d.objects.points[pX][pY];
        if (Object.keys(d.objects.points[pX]).length === 0)
            delete d.objects.points[pX];
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

const endDraw = (cancel = true) => {
    if (cancel)
        d.current.element?.remove();
    
    d.current.element = null;
};

pointButton.addEventListener('click', () => {
    d.current.brush = 'point';
    endDraw();
    pointButton.classList.add('active');
    lineButton.classList.remove('active');
});

lineButton.addEventListener('click', () => {
    d.current.brush = 'line';
    endDraw();
    lineButton.classList.add('active');
    pointButton.classList.remove('active');
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
    if (Date.now() - d.last.clickTS <= 300) {
        const posX = get('x', d.last.pos.x, true), posY = get('y', d.last.pos.y, true);
        if (d.current.brush === 'point')
            togglePointAt(posX, posY, true);
        else if (d.current.brush === 'line')
            processLineAt(posX, posY);
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
