package game

import (
	"testing"
)

func TestGroupAtCountsStonesAndDistinctLiberties(t *testing.T) {
	b := FromDiagram([]string{".XX..", "XX...", ".....", ".....", "....."})
	group := GroupAt(b, Point{X: 1, Y: 0})
	if len(group.Stones) != 4 || group.Liberties != 5 {
		t.Fatalf("group = %+v", group)
	}
}

// fiveLibertyGroup is the black group in the top left corner. It has exactly five liberties.
func fiveLibertyGroup() (Board, int, *Scratch) {
	b := FromDiagram([]string{".XX..", "XX...", ".....", ".....", "....."})
	return b, b.Index(Point{X: 1, Y: 0}), NewScratch(b.Len())
}

func TestHasLibertiesAgreesWithTheExactCount(t *testing.T) {
	b, origin, s := fiveLibertyGroup()
	if !b.hasLiberties(origin, 5, s) || b.hasLiberties(origin, 6, s) {
		t.Fatal("hasLiberties disagrees with the exact count")
	}
}

func TestGroupWithFiveLibertiesHasOneAndIsNotInAtari(t *testing.T) {
	b, origin, s := fiveLibertyGroup()
	if !b.HasAnyLiberty(origin, s) || b.InAtari(origin, s) {
		t.Fatal("a group with five liberties has one and is not in atari")
	}
}

func TestCountLibertiesIsExact(t *testing.T) {
	b, origin, s := fiveLibertyGroup()
	if got := countLiberties(b, origin, s); got != 5 {
		t.Fatalf("countLiberties = %d, want 5", got)
	}
}

func TestRemoveGroupClearsTheWholeChain(t *testing.T) {
	b := FromDiagram([]string{"OXX..", "XX...", ".....", ".....", "....."})
	s := NewScratch(b.Len())
	if removed := b.RemoveGroup(b.Index(Point{X: 1, Y: 1}), s); removed != 4 {
		t.Fatalf("removed = %d", removed)
	}
	if b.Count(Black) != 0 || b.Count(White) != 1 {
		t.Fatal("wrong stones removed")
	}
}

func TestCellIsASetOfColours(t *testing.T) {
	if Black.Opponent() != White || White.Opponent() != Black {
		t.Fatal("Opponent must clear one bit and keep the other")
	}
	both := Black | White
	if both&Black == 0 || both&White == 0 || Black&White != 0 {
		t.Fatal("colours must be distinct bits")
	}
}
