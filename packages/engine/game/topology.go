package game

import "sync"

var orthogonal = [4]Point{{1, 0}, {-1, 0}, {0, 1}, {0, -1}}
var diagonal = [4]Point{{1, 1}, {1, -1}, {-1, 1}, {-1, -1}}

type topology struct {
	neighbors [][]int
	diagonals [][]int
}

var topologies sync.Map // size -> *topology

func topologyFor(size int) *topology {
	if t, ok := topologies.Load(size); ok {
		return t.(*topology)
	}
	t, _ := topologies.LoadOrStore(size, buildTopology(size))
	return t.(*topology)
}

func buildTopology(size int) *topology {
	n := size * size
	t := &topology{neighbors: make([][]int, n), diagonals: make([][]int, n)}
	for i := range n {
		p := pointOf(size, i)
		t.neighbors[i] = adjacent(size, p, orthogonal)
		t.diagonals[i] = adjacent(size, p, diagonal)
	}
	return t
}

func adjacent(size int, p Point, offsets [4]Point) []int {
	indices := make([]int, 0, 4)
	for _, d := range offsets {
		q := Point{p.X + d.X, p.Y + d.Y}
		if onBoard(size, q) {
			indices = append(indices, indexOf(size, q))
		}
	}
	return indices
}
