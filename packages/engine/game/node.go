package game

import (
	"math"
	"math/rand/v2"
)

const exploration = math.Sqrt2

type node struct {
	position Position
	move     moveIndex
	parent   *node
	children []*node
	untried  []moveIndex
	listed   bool
	visits   int
	wins     int
}

// listMoves is done once, on the first visit, so the many leaves that are never visited again do not pay for it.
func (n *node) listMoves(s *Scratch) {
	if n.listed {
		return
	}
	n.untried = candidateMoves(n.position, s)
	n.listed = true
}

// mover is the colour that made the move leading to this node. The wins counted in this node are wins for that colour.
func (n *node) mover() Cell {
	return n.position.ToPlay.Opponent()
}

func (n *node) winRate() float64 {
	if n.visits == 0 {
		return 0
	}
	return float64(n.wins) / float64(n.visits)
}

func (n *node) terminal() bool {
	return n.position.Finished()
}

func (n *node) fullyExpanded() bool {
	return len(n.untried) == 0
}

func (n *node) expand(rng *rand.Rand) *node {
	i := rng.IntN(len(n.untried))
	m := n.untried[i]
	n.untried[i] = n.untried[len(n.untried)-1]
	n.untried = n.untried[:len(n.untried)-1]
	child := &node{position: apply(n.position, m), move: m, parent: n}
	n.children = append(n.children, child)
	return child
}

// selectChild picks by UCB1. A child is always visited once when it is made, because Search backpropagates right after expandOne, so visits is never 0 here.
func (n *node) selectChild() *node {
	best, bestScore := n.children[0], math.Inf(-1)
	logVisits := math.Log(float64(n.visits))
	for _, child := range n.children {
		score := child.winRate() + exploration*math.Sqrt(logVisits/float64(child.visits))
		if score > bestScore {
			best, bestScore = child, score
		}
	}
	return best
}

func (n *node) mostVisitedChild() *node {
	var best *node
	for _, child := range n.children {
		if best == nil || child.visits > best.visits {
			best = child
		}
	}
	return best
}

func (n *node) record(winner Cell) {
	n.visits++
	if winner == n.mover() {
		n.wins++
	}
}
